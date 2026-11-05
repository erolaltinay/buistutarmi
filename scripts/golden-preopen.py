#!/usr/bin/env python3
"""tests/fixtures/golden-preopen.json dosyasını üretir (SPEC-calc-engine §5.1, §15).

Motordan bağımsız, yalnız şartnameden yazılmış hesap. packages/engine'i okumaz veya çağırmaz; golden testin
anlamı budur. Önce 30 vakayı p = 0 ile doğrular; tutmazsa dosya yazmadan çıkar.

Çalıştırma: python scripts/golden-preopen.py
"""
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'tests/fixtures/golden-cases.json'
TARGET = ROOT / 'tests/fixtures/golden-preopen.json'

CASES = [
    ('coffee-ist-default', 3),
    ('barber-ist-default', 2),
    ('coffee-nyc-default', 4),
    ('barber-nyc-default', 6),
    ('coffee-ist-all_equity', 3),
    ('coffee-ist-strong_open', 2),
]

ROUNDS = 5
OTHER_SHARE = 0.3
MAX_P = 24


def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) else 0


def pc(v):
    return num(v) / 100


def clamp(x):
    return min(1, max(0, x))


def js_round(x):
    return math.floor(x + 0.5)


def annuity(p, r, n):
    if p <= 0:
        return 0
    return p * r / (1 - (1 + r) ** -n) if r > 0 else p / n


def fixed_type(row):
    if row.get('type'):
        return row['type']
    k = row.get('k') or ''
    name = row.get('n') or ''
    if k == 'rent' or (not k and re.search('kira|rent', name, re.I)):
        return 'rent'
    if k.startswith('staff') or (not k and re.search('personel|staff|maaş|wage|payroll', name, re.I)):
        return 'staff'
    return 'other'


def calculate(i, preopen):
    f = i['fin']
    # §2
    fee = pc(f['cardShare']) * pc(f['cardFee']) + pc(f['platShare']) * pc(f['platFee'])
    mix = sum(num(x['mix']) for x in i['items'])
    ticket = sum(num(x['price']) * num(x['mix']) for x in i['items']) / mix if mix > 0 else 0
    cost = sum(num(x['cost']) * num(x['mix']) for x in i['items']) / mix if mix > 0 else 0
    ticket_net = ticket / (1 + pc(f['kdv']))
    cm = ticket_net - cost * (1 + pc(f['waste'])) - ticket * fee if mix > 0 else 0

    # §3
    stp = min(0.9, pc(f['stopaj']))
    emp = pc(f['employer'])
    rent0 = staff0 = other0 = 0
    for row in i['fixed']:
        kind = fixed_type(row)
        if kind == 'rent':
            rent0 += num(row['v']) / (1 - stp)
        elif kind == 'staff':
            staff0 += num(row['v']) * (1 + emp)
        else:
            other0 += num(row['v'])
    founder = i['loc']['founder']
    mgr_raw = num(founder['mgr']) if founder['role'] == 'investor' else num(founder['mgr']) / 2 if founder['role'] == 'part' else 0
    mgr = mgr_raw * (1 + emp)
    owner = num(f['ownerSalary'])
    op_fixed = rent0 + staff0 + other0 + mgr + owner

    # §4
    sub = sum(num(x['v']) for x in i['capex'])
    capex_total = sub * (1 + pc(i['contPct']))
    non_dep = sum(num(x['v']) for x in i['capex'] if x.get('k') in ('stock', 'stockB', 'permits'))
    dep_base = max(0, capex_total - non_dep)
    eq = clamp(pc(founder['equity']))
    cushion = op_fixed * num(i['wcMonths'])
    base = num(i['scen'][1])
    days = max(1, num(i['days']))
    r = pc(f['loanRate']) / 12
    term = max(1, js_round(num(f['loanTerm'])))
    p = min(MAX_P, max(0, js_round(num(preopen))))
    monthly_pre = rent0 + other0 * OTHER_SHARE

    def project(loan, pmt):
        rs = clamp(pc(f['rampStart']))
        rm = max(1, js_round(num(f['rampMonths'])))
        dep = dep_base / (max(1, num(f['depYears'])) * 12)
        g = lambda rate, m: (1 + pc(rate)) ** ((m - 1) / 12)
        st = lambda rate, m: (1 + pc(rate)) ** math.floor((m - 1) / 12)
        bal = loan
        cash = trough = loss = 0
        trough_m = 0
        first = None
        sum24 = 0
        rows = []
        pre_interest = 0
        # §5.1
        for _ in range(p):
            interest = bal * r if bal > 0 else 0
            pre_interest += interest
            cash -= monthly_pre + interest
            loss += monthly_pre + interest
            if cash < trough:
                trough = cash
                trough_m = 0
        # §5
        for m in range(1, 61):
            ramp = 1 if m >= rm else rs + (1 - rs) * (m - 1) / max(1, rm - 1)
            units = base * days * ramp
            gross = units * ticket * g(f['priceInc'], m)
            net = gross / (1 + pc(f['kdv']))
            cogs = units * cost * (1 + pc(f['waste'])) * g(f['inflCost'], m)
            fees = gross * fee
            fixed = rent0 * st(f['rentInc'], m) + (staff0 + mgr + owner) * st(f['wageInc'], m) + other0 * g(f['inflCost'], m)
            ebitda = net - cogs - fees - fixed
            interest = bal * r if bal > 0 else 0
            pay = min(pmt, bal + interest) if bal > 0 else 0
            principal = max(0, pay - interest)
            bal = max(0, bal - principal)
            ebt = ebitda - dep - interest
            if ebt > 0:
                use = min(loss, ebt)
                loss -= use
                taxable = ebt - use
            else:
                taxable = 0
                loss += -ebt
            ni = ebt - taxable * pc(f['profitTax'])
            cash += ni + dep - principal
            if m <= 24 and cash < trough:
                trough = cash
                trough_m = m
            if first is None and ni > 0:
                first = m
            if m <= 24:
                sum24 += ni
            rows.append({'units': units, 'gross': gross, 'ebitda': ebitda, 'netIncome': ni, 'cash': cash, 'dep': dep})
        return {'rows': rows, 'trough': -trough, 'troughM': trough_m, 'first': first, 'sum24': sum24, 'preInterest': pre_interest}

    trough = op_fixed * 2
    loan = pmt = 0
    proj = None
    for _ in range(ROUNDS):
        invest = capex_total + trough + cushion
        loan = invest * (1 - eq)
        pmt = annuity(loan, r, term)
        proj = project(loan, pmt)
        trough = proj['trough']
    invest = capex_total + trough + cushion

    # §6
    cash_fixed = op_fixed + pmt
    per_month = cash_fixed / cm if cm > 0 else None
    cum = 0
    pay_open = pay_all = None
    for m, row in enumerate(proj['rows'], 1):
        cum += row['netIncome'] + row['dep']
        if pay_open is None and cum >= capex_total:
            pay_open = m + p
        if pay_all is None and cum >= invest:
            pay_all = m + p
    month = lambda m: {k: proj['rows'][m - 1][k] for k in ('units', 'gross', 'ebitda', 'netIncome', 'cash')}
    return {
        'unit': {'ticket': ticket, 'ticketNet': ticket_net, 'cm': cm},
        'fixed': {'opFixed': op_fixed, 'loan': loan, 'monthlyLoanPayment': pmt},
        'breakEven': {'perDay': per_month / days if per_month is not None else None, 'perMonth': per_month},
        'investment': {
            'capexTotal': capex_total,
            'cashTrough': proj['trough'],
            'troughMonth': proj['troughM'],
            'cushion': cushion,
            'total': invest,
            'preOpen': {
                'months': p,
                'monthlyCost': monthly_pre if p else 0,
                'interest': proj['preInterest'],
                'total': p * monthly_pre + proj['preInterest'],
            },
        },
        'projection': {
            'firstProfitMonth': proj['first'],
            'sum24NetProfit': proj['sum24'],
            'paybackTotalMonths': pay_all,
            'paybackStartupMonths': pay_open,
            'month1': month(1),
            'month12': month(12),
            'month24': month(24),
        },
        'scenarios': [num(s) * days * cm - cash_fixed for s in i['scen']],
    }


def differences(expected, actual, tol, path=''):
    out = []
    if isinstance(expected, dict):
        for k, v in expected.items():
            if k in actual:
                out += differences(v, actual[k], tol, f'{path}.{k}')
    elif isinstance(expected, list):
        for n, v in enumerate(expected):
            out += differences(v, actual[n], tol, f'{path}[{n}]')
    elif expected is None or actual is None:
        if expected != actual:
            out.append((path, expected, actual))
    elif abs(expected - actual) > max(tol['relative'] * abs(expected), tol['absolute']):
        out.append((path, expected, actual))
    return out


def main():
    source = json.loads(SOURCE.read_text(encoding='utf-8'))
    tol = source['tolerance']
    by_id = {c['id']: c for c in source['cases']}
    keys = ('unit', 'fixed', 'breakEven', 'investment', 'projection', 'scenarios')
    failed = 0
    for case in source['cases']:
        actual = calculate(case['input'], 0)
        expected = {k: case['expected'][k] for k in keys}
        diff = differences(expected, actual, tol)
        if diff:
            failed += 1
            print(case['id'], diff[:4])
    if failed:
        sys.exit(f'{failed} vaka tutmadı; dosya yazılmadı.')
    print(f"{len(source['cases'])} vaka p = 0 ile doğrulandı.")

    cases = []
    for case_id, months in CASES:
        base = by_id[case_id]
        cases.append({
            'id': f'{case_id}-preopen{months}',
            'input': {**base['input'], 'preOpenMonths': months},
            'expected': calculate(base['input'], months),
        })
        inv = cases[-1]['expected']['investment']
        print(f"{cases[-1]['id']}: dip {inv['cashTrough']:.0f} (ay {inv['troughMonth']}), toplam {inv['total']:.0f}, bekleme {inv['preOpen']['total']:.0f}")
    out = {
        'generatedFrom': 'scripts/golden-preopen.py (SPEC-calc-engine §5.1; motordan bağımsız)',
        'tolerance': tol,
        'cases': cases,
    }
    TARGET.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('yazıldı:', TARGET.name)


if __name__ == '__main__':
    main()
