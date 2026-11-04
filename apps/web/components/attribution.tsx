'use client';
// Her sayfa açılışında video kaynağını kaydeder; ekranda bir şey göstermez.
import { useEffect } from 'react';
import { captureLanding } from '../lib/analytics';

export function AttributionCapture() {
  useEffect(() => captureLanding(window.location.search), []);
  return null;
}
