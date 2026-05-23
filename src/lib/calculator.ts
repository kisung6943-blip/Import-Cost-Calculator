/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ImportShipmentSession, CalculationResult, CurrencyType } from '../types';

/**
 * Calculates the total commission in KRW including optional VAT.
 */
export function calculateCommissionKrw(amount: number, exchangeRate: number, hasVat: boolean): {
  supplyPrice: number;
  vat: number;
  total: number;
} {
  const supplyPrice = Math.round(amount * exchangeRate);
  const vat = hasVat ? Math.round(supplyPrice * 0.1) : 0;
  return {
    supplyPrice,
    vat,
    total: supplyPrice + vat,
  };
}

/**
 * Perform precise import goods cost allocation calculations.
 */
export function calculateImportCosts(session: ImportShipmentSession): {
  itemsResults: CalculationResult[];
  totalResaleForeignAmount: number;
  totalAmortizedForeignAmount: number;
  totalForeignAmount: number;
  averageRemittanceRate: number;
  amortizedKrwSum: number;
  commissionSummary: { supplyPrice: number; vat: number; total: number };
  totalDisbursementKrw: number; // 총지불액 + 조정금액
} {
  const { items, indirectCosts, commission, allocationMethod, baseExchangeRate } = session;

  // 1. Separate Resale & Amortized Items
  const resaleItems = items.filter(item => !item.isAmortized);
  const amortizedItems = items.filter(item => item.isAmortized);

  // 2. Compute Foreign Currency Totals
  const totalResaleForeignAmount = resaleItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const totalAmortizedForeignAmount = amortizedItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const totalForeignAmount = totalResaleForeignAmount + totalAmortizedForeignAmount;

  // 3. Compute Remittance Rate
  // If remittanceKrw is provided, we compute the average remittance rate (used instead of standard baseExchangeRate
  // because the actual bank transfer might have been done at a different spot rate).
  // If remittanceKrw is 0 but we have items, we simulate it based on totalForeignAmount * baseExchangeRate.
  let averageRemittanceRate = baseExchangeRate;
  if (indirectCosts.remittanceKrw > 0 && totalForeignAmount > 0) {
    averageRemittanceRate = indirectCosts.remittanceKrw / totalForeignAmount;
  }

  // Calculate Amortized Item cost in KRW using the remittance rate
  const amortizedKrwSum = amortizedItems.reduce((acc, item) => {
    const itemForeignTotal = item.quantity * item.unitPrice;
    return acc + Math.round(itemForeignTotal * averageRemittanceRate);
  }, 0);

  // 4. Calculate Commission KRW
  const commissionSummary = calculateCommissionKrw(commission.amount, commission.exchangeRate, commission.hasVat);

  // 5. Total other disbursements (all items in indirect expenses except direct base remittance)
  const otherIndirectKrw = 
    indirectCosts.jmaxFee +
    indirectCosts.customsDuty +
    indirectCosts.vat +
    indirectCosts.brokerFee +
    indirectCosts.courierFee +
    indirectCosts.certificationFee +
    indirectCosts.quarantineFee +
    indirectCosts.otherFee +
    commissionSummary.total;

  // Total cash disbursements of the shipment
  const totalDisbursementKrw = indirectCosts.remittanceKrw + 
    indirectCosts.jmaxFee + 
    indirectCosts.customsDuty + 
    indirectCosts.vat + 
    indirectCosts.brokerFee + 
    indirectCosts.courierFee + 
    indirectCosts.certificationFee + 
    indirectCosts.quarantineFee + 
    indirectCosts.otherFee + 
    commissionSummary.total;

  // 6. Calculate Allocation Weights of active resale items (quantity > 0)
  const activeResaleItems = resaleItems.filter(item => item.quantity > 0);
  let totalWeight = 0;
  const itemWeights = activeResaleItems.map(item => {
    let weight = 0;
    if (allocationMethod === 'PRICE_RATIO') {
      weight = item.quantity * item.unitPrice;
    } else if (allocationMethod === 'QTY_RATIO') {
      weight = item.quantity;
    } else {
      weight = 1;
    }
    totalWeight += weight;
    return { id: item.id, weight };
  });

  // 7. Distribute general indirect costs + amortized items
  const globalDuty = indirectCosts.customsDuty;
  const globalVat = indirectCosts.vat;
  const hasSpecificTariffs = activeResaleItems.some(item => (item.tariffRate ?? 0) > 0);

  let distributedDutiesKrw: Record<string, number> = {};
  let distributedVatsKrw: Record<string, number> = {};

  if (activeResaleItems.length > 0) {
    if (globalDuty > 0 && hasSpecificTariffs) {
      // If we have custom duty and some specific tariff rates are specified:
      const idealDuties = activeResaleItems.map(item => {
        const foreignValue = item.quantity * item.unitPrice;
        const baseKrw = foreignValue * averageRemittanceRate;
        const duty = baseKrw * ((item.tariffRate || 0) / 100);
        return { id: item.id, duty };
      });
      const totalIdealDuty = idealDuties.reduce((acc, d) => acc + d.duty, 0);

      // Scale to match the actual global duty paid
      activeResaleItems.forEach(item => {
        const ideal = idealDuties.find(d => d.id === item.id)?.duty || 0;
        distributedDutiesKrw[item.id] = totalIdealDuty > 0 
          ? Math.round(ideal * (globalDuty / totalIdealDuty)) 
          : Math.round(globalDuty / activeResaleItems.length);
      });
    } else {
      // Proportional or equal allocation of global duty
      activeResaleItems.forEach(item => {
        const wt = itemWeights.find(w => w.id === item.id)?.weight || 0;
        const factor = totalWeight > 0 ? (wt / totalWeight) : (1 / activeResaleItems.length);
        distributedDutiesKrw[item.id] = Math.round(globalDuty * factor);
      });
    }

    // Same logic for global VAT (세관 부가세)
    activeResaleItems.forEach(item => {
      const wt = itemWeights.find(w => w.id === item.id)?.weight || 0;
      const factor = totalWeight > 0 ? (wt / totalWeight) : (1 / activeResaleItems.length);
      distributedVatsKrw[item.id] = Math.round(globalVat * factor);
    });
  }

  // Other indirects (excluding customsDuty and vat which were handled individually)
  const otherIndirectToAllocate = otherIndirectKrw - globalDuty - globalVat + amortizedKrwSum;

  const itemsResults: CalculationResult[] = resaleItems.map(item => {
    // If quantity is 0 or less, this item is a placeholder and should have 0 costs allocated
    if (item.quantity <= 0) {
      return {
        itemId: item.id,
        itemName: item.name,
        quantity: item.quantity,
        foreignTotal: 0,
        allocatedIndirectKrw: 0,
        allocatedDutyKrw: 0,
        allocatedVatKrw: 0,
        totalCostKrw: 0,
        unitCostKrw: 0,
      };
    }

    const wt = itemWeights.find(w => w.id === item.id)?.weight || 0;
    const factor = totalWeight > 0 ? (wt / totalWeight) : (1 / activeResaleItems.length);

    const baseKrw = Math.round((item.quantity * item.unitPrice) * averageRemittanceRate);
    const allocatedIndirectKrw = Math.round(otherIndirectToAllocate * factor);
    const allocatedDutyKrw = distributedDutiesKrw[item.id] || 0;
    const allocatedVatKrw = distributedVatsKrw[item.id] || 0;

    const totalCostKrw = baseKrw + allocatedIndirectKrw + allocatedDutyKrw + allocatedVatKrw;
    const unitCostKrw = Math.ceil(totalCostKrw / item.quantity);

    return {
      itemId: item.id,
      itemName: item.name,
      quantity: item.quantity,
      foreignTotal: item.quantity * item.unitPrice,
      allocatedIndirectKrw,
      allocatedDutyKrw,
      allocatedVatKrw,
      totalCostKrw,
      unitCostKrw,
    };
  });

  return {
    itemsResults,
    totalResaleForeignAmount,
    totalAmortizedForeignAmount,
    totalForeignAmount,
    averageRemittanceRate,
    amortizedKrwSum,
    commissionSummary,
    totalDisbursementKrw,
  };
}
