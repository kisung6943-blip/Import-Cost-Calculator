/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ImportShipmentSession } from './types';

export const SAMPLE_SESSIONS: ImportShipmentSession[] = [
  {
    id: 'sample-2025-02-07',
    title: '2025.2.7 하부손잡이 정산 건',
    date: '2025-02-07',
    currency: 'USD',
    baseExchangeRate: 1451.21, // 송금액 5,524,764 KRW / 3807 USD = 1451.21
    allocationMethod: 'PRICE_RATIO',
    targetProfitPercent: 30,
    items: [
      {
        id: 'item-1',
        name: '신형2.5아랫손잡이',
        quantity: 2000,
        unitPrice: 0.866,
        tariffRate: 0, // 이미지 상 관세/부가세 별도 기재 없음
        isAmortized: false,
        note: '수입 주 품목',
      },
      {
        id: 'item-2',
        name: '금형비',
        quantity: 1,
        unitPrice: 2075,
        tariffRate: 0,
        isAmortized: true, // 금형비는 부대비용처럼 타 품목으로 배부
        note: '제품 생산용 금형 일시 비용 (신형2.5아랫손잡이 원가에 100% 배부)',
      },
      {
        id: 'item-3',
        name: '추가 품목 1',
        quantity: 0,
        unitPrice: 0,
        tariffRate: 0,
        isAmortized: false,
        note: '수량과 단가를 입력하세요',
      },
      {
        id: 'item-4',
        name: '추가 품목 2',
        quantity: 0,
        unitPrice: 0,
        tariffRate: 0,
        isAmortized: false,
        note: '수량과 단가를 입력하세요',
      },
      {
        id: 'item-5',
        name: '추가 품목 3',
        quantity: 0,
        unitPrice: 0,
        tariffRate: 0,
        isAmortized: false,
        note: '수량과 단가를 입력하세요',
      },
    ],
    indirectCosts: {
      remittanceKrw: 5524764,
      jmaxFee: 606244,
      customsDuty: 0,
      vat: 0,
      brokerFee: 373340,
      courierFee: 0,
      certificationFee: 0,
      quarantineFee: 0,
      otherFee: 0,
      exchangeAdjustment: 1751,
    },
    commission: {
      amount: 114.21,
      exchangeRate: 1300,
      hasVat: true,
      usePercent: true,
      percentRate: 3,
    },
  },
  {
    id: 'sample-general',
    title: '일반 다품종 수입 정산 시뮬레이션',
    date: '2026-05-23',
    currency: 'USD',
    baseExchangeRate: 1345,
    allocationMethod: 'PRICE_RATIO',
    targetProfitPercent: 25,
    items: [
      {
        id: 'general-1',
        name: '프리미엄 무선 전동 드라이버',
        quantity: 500,
        unitPrice: 12.5,
        tariffRate: 8,
        isAmortized: false,
        note: 'A급 인기 모델',
      },
      {
        id: 'general-2',
        name: '정밀 드라이버 비트 세트 (48포켓)',
        quantity: 1500,
        unitPrice: 2.8,
        tariffRate: 8,
        isAmortized: false,
        note: '회전율 높은 부속품',
      },
      {
        id: 'general-3',
        name: '수입 박스 포장 및 완충재 단가 분담',
        quantity: 1,
        unitPrice: 350,
        tariffRate: 0,
        isAmortized: true, // 포장 및 보강 목적으로 배부
        note: '모든 품목의 외화 대금 비율에 비례 자동 배부',
      },
    ],
    indirectCosts: {
      remittanceKrw: 14526000, // 약 10,800 USD에 대한 한화 송금액
      jmaxFee: 450000,
      customsDuty: 1150000,
      vat: 1430000,
      brokerFee: 220000,
      courierFee: 180000,
      certificationFee: 550000,
      quarantineFee: 0,
      otherFee: 65000,
      exchangeAdjustment: 0,
    },
    commission: {
      amount: 320,
      exchangeRate: 1345,
      hasVat: true,
      usePercent: true,
      percentRate: 3,
    },
  },
];
