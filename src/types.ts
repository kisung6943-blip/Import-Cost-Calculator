/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CurrencyType = 'USD' | 'JPY' | 'CNY' | 'EUR' | 'KRW';

export interface ImportItem {
  id: string;
  name: string; // 품목명
  quantity: number; // 수량
  unitPrice: number; // 단가 (외화)
  tariffRate: number; // 개별 관세율 (%)
  isAmortized: boolean; // 금형비 등 다른 품목에 원가 배출/배부할 비용 여부
  note?: string; // 비고
}

export interface CommissionConfig {
  amount: number; // 수수료 외화 금액
  exchangeRate: number; // 수수료 적용 환율
  hasVat: boolean; // 부가세 여부
  usePercent?: boolean; // 외화합계 비례 수수료 계산 적용 여부
  percentRate?: number; // 수수료 비율 (%)
}

export interface IndirectCosts {
  remittanceKrw: number; // 송금액 (물품 대금 외화 송금 원화 상당액)
  jmaxFee: number; // 제이맥스 등 대행 실비
  customsDuty: number; // 관세
  vat: number; // 부가세 (세관 납부액)
  brokerFee: number; // 관세사 수수료
  courierFee: number; // 택배비 / 공장 운송비
  certificationFee: number; // 표준 인증 비용
  quarantineFee: number; // 정밀 검역 수수료
  otherFee: number; // 기타 잡비
  exchangeAdjustment: number; // 환율정산액 / 정산 조정
}

export type AllocationMethod = 
  | 'PRICE_RATIO' // 외화 대금 비율 배부 (가장 보편적)
  | 'QTY_RATIO'   // 수량 비율 배부
  | 'EQUAL';      // 평등 균등 배부

export interface CalculationResult {
  itemId: string;
  itemName: string;
  quantity: number;
  foreignTotal: number;
  allocatedIndirectKrw: number;
  allocatedDutyKrw: number;
  allocatedVatKrw: number;
  totalCostKrw: number;
  unitCostKrw: number;
  marginAtPrice?: number; // 특정 판매가 주어졌을 때 마진율
}

export interface ImportShipmentSession {
  id: string;
  title: string; // 정산 건 제목 (예: "2025.2.7 수입 건")
  date: string; // 수입 일자
  currency: CurrencyType; // 기준 외화
  baseExchangeRate: number; // 기준환율
  items: ImportItem[];
  indirectCosts: IndirectCosts;
  commission: CommissionConfig;
  allocationMethod: AllocationMethod;
  targetProfitPercent: number; // 목표 마진율 (%)
}
