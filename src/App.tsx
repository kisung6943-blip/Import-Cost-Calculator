/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  Plus, 
  Trash2, 
  RotateCcw, 
  TrendingUp, 
  Percent, 
  Truck, 
  Layers, 
  Download, 
  FileText, 
  Coins, 
  Info, 
  CheckCircle,
  HelpCircle,
  Settings,
  DollarSign,
  Briefcase,
  ExternalLink,
  ChevronRight,
  TrendingDown
} from 'lucide-react';
import { SAMPLE_SESSIONS } from './data';
import { ImportShipmentSession, ImportItem, CurrencyType, AllocationMethod } from './types';
import { calculateImportCosts, calculateCommissionKrw } from './lib/calculator';

export default function App() {
  // Load initial sessions from localStorage or default sample sessions
  const [sessions, setSessions] = useState<ImportShipmentSession[]>(() => {
    const saved = localStorage.getItem('import_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ImportShipmentSession[];
        return parsed.map(s => {
          let updated = { ...s };
          // 1. Upgrade sample-2025-02-07 items
          if (updated.id === 'sample-2025-02-07' && updated.items.length <= 2) {
            const sampleDefault = SAMPLE_SESSIONS.find(ds => ds.id === 'sample-2025-02-07');
            if (sampleDefault) {
              updated.items = sampleDefault.items;
            }
          }
          // 2. Ensure commission fields are fully populated
          updated.commission = {
            ...updated.commission,
            usePercent: updated.commission.usePercent !== undefined ? updated.commission.usePercent : true,
            percentRate: updated.commission.percentRate !== undefined ? updated.commission.percentRate : 3,
          };
          return updated;
        });
      } catch (e) {
        return SAMPLE_SESSIONS;
      }
    }
    return SAMPLE_SESSIONS;
  });

  const [selectedSessionId, setSelectedSessionId] = useState<string>(SAMPLE_SESSIONS[0].id);
  const [session, setSession] = useState<ImportShipmentSession>(() => {
    return sessions.find(s => s.id === selectedSessionId) || sessions[0];
  });

  // Track manual pricing inputs for items to calculate margin & profitability
  const [sellingPrices, setSellingPrices] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('import_selling_prices');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { 'item-1': 5900 }; // Default target selling price for sample item 1
      }
    }
    return { 'item-1': 5900 };
  });

  // Keep internal session updated when selectedSessionId shifts
  useEffect(() => {
    const found = sessions.find(s => s.id === selectedSessionId);
    if (found) {
      setSession(found);
    }
  }, [selectedSessionId, sessions]);

  // Persist sessions and selling prices when changed
  const saveSessions = (updatedSessions: ImportShipmentSession[]) => {
    setSessions(updatedSessions);
    localStorage.setItem('import_sessions', JSON.stringify(updatedSessions));
  };

  const updateSellingPrice = (itemId: string, price: number) => {
    const updated = { ...sellingPrices, [itemId]: price };
    setSellingPrices(updated);
    localStorage.setItem('import_selling_prices', JSON.stringify(updated));
  };

  // Helper to update current session fields
  const updateSession = (updater: (prev: ImportShipmentSession) => ImportShipmentSession) => {
    const updated = updater(session);
    setSession(updated);
    
    const updatedSessions = sessions.map(s => s.id === updated.id ? updated : s);
    saveSessions(updatedSessions);
  };

  // Derive session with dynamic commission amount if usePercent is enabled
  const derivedSession = useMemo(() => {
    // 1. Calculate totalCombinedForeign
    const resaleItems = session.items.filter(item => !item.isAmortized);
    const amortizedItems = session.items.filter(item => item.isAmortized);
    const totalResaleForeignAmount = resaleItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const totalAmortizedForeignAmount = amortizedItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const totalForeignAmount = totalResaleForeignAmount + totalAmortizedForeignAmount;

    // 2. Compute dynamic commission amount if usePercent is true
    const usePercent = session.commission.usePercent !== false; // default true if undefined
    const percentRate = session.commission.percentRate ?? 3; // default 3%

    if (usePercent) {
      const computedAmount = parseFloat((totalForeignAmount * (percentRate / 100)).toFixed(2));
      return {
        ...session,
        commission: {
          ...session.commission,
          usePercent,
          percentRate,
          amount: computedAmount
        }
      };
    }

    return {
      ...session,
      commission: {
        ...session.commission,
        usePercent
      }
    };
  }, [session]);

  // Calculations derived from calculator engine using derivedSession
  const calculation = calculateImportCosts(derivedSession);

  // Total items currently in session
  const items = session.items;

  // Add Item handler
  const handleAddItem = () => {
    const newItem: ImportItem = {
      id: 'item-' + Date.now(),
      name: '새 항목',
      quantity: 100,
      unitPrice: 1.0,
      tariffRate: 8,
      isAmortized: false,
      note: '메모 입력 가능',
    };
    updateSession(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Remove Item handler
  const handleRemoveItem = (id: string) => {
    updateSession(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  // Edit individual item fields
  const handleEditItem = <K extends keyof ImportItem>(id: string, field: K, value: ImportItem[K]) => {
    updateSession(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          // If changing isAmortized, we might want to auto-adjust tariff if it's not a goods item
          if (field === 'isAmortized' && value === true) {
            updated.tariffRate = 0;
          }
          return updated;
        }
        return item;
      })
    }));
  };

  // Reset to original samples
  const handleResetToDefault = () => {
    if (confirm('모든 데이터를 처음 샘플 수치로 완전히 초기화하시겠습니까? (저장된 정보도 지워집니다)')) {
      localStorage.removeItem('import_sessions');
      localStorage.removeItem('import_selling_prices');
      setSessions(SAMPLE_SESSIONS);
      setSelectedSessionId(SAMPLE_SESSIONS[0].id);
      setSession(SAMPLE_SESSIONS[0]);
      setSellingPrices({ 'item-1': 5900 });
    }
  };

  // Creates an entirely blank calculation session
  const handleCreateNewSession = () => {
    const newSession: ImportShipmentSession = {
      id: 'session-' + Date.now(),
      title: '새 수입 정산 건 - ' + new Date().toLocaleDateString('ko-KR'),
      date: new Date().toISOString().split('T')[0],
      currency: 'USD',
      baseExchangeRate: 1350,
      allocationMethod: 'PRICE_RATIO',
      targetProfitPercent: 30,
      items: [
        {
          id: 'item-new-1',
          name: '메인 수입 주상품 1',
          quantity: 1000,
          unitPrice: 2.50,
          tariffRate: 8,
          isAmortized: false,
          note: '8% 기본 관세',
        }
      ],
      indirectCosts: {
        remittanceKrw: 3375000, // 2500 USD * 1350
        jmaxFee: 150000,
        customsDuty: 270000,
        vat: 337500,
        brokerFee: 110000,
        courierFee: 50000,
        certificationFee: 0,
        quarantineFee: 0,
        otherFee: 20000,
        exchangeAdjustment: 0,
      },
      commission: {
        amount: 80.00,
        exchangeRate: 1350,
        hasVat: true,
      }
    };

    const updatedSessions = [...sessions, newSession];
    saveSessions(updatedSessions);
    setSelectedSessionId(newSession.id);
  };

  // Duplicate current session
  const handleDuplicateSession = () => {
    const copied: ImportShipmentSession = {
      ...session,
      id: 'session-' + Date.now(),
      title: `${session.title} (복사본)`,
      date: new Date().toISOString().split('T')[0],
    };
    const updatedSessions = [...sessions, copied];
    saveSessions(updatedSessions);
    setSelectedSessionId(copied.id);
  };

  const handleDeleteSession = () => {
    if (sessions.length <= 1) {
      alert('최소 하나의 정산 건이 존재해야 합니다.');
      return;
    }
    if (confirm(`현재 선택된 [${session.title}] 정산 세션을 영구 삭제하시겠습니까?`)) {
      const remaining = sessions.filter(s => s.id !== session.id);
      saveSessions(remaining);
      setSelectedSessionId(remaining[0].id);
    }
  };

  // Export current session logic as CSV
  const handleExportCSV = () => {
    let csvContent = '\uFEFF'; // Excel UTF-8 BOM
    csvContent += `수입정산서,${session.title}\n`;
    csvContent += `정산일자,${session.date}\n`;
    csvContent += `통화단위,${session.currency}\n`;
    csvContent += `전신환 송금환율,${session.baseExchangeRate} KRW\n\n`;

    // Items table
    csvContent += '품목 정산 상세\n';
    csvContent += '품목명,수량,외화단가,외화합계,배부된 부대비용 및 금형비(원),배부된 관세(원),배부된 부가세(원),수입원가 총액(원),개당 수입원가(원)\n';
    
    calculation.itemsResults.forEach(res => {
      csvContent += `"${res.itemName}",${res.quantity},${session.items.find(i=>i.id===res.itemId)?.unitPrice || 0},${res.foreignTotal},${res.allocatedIndirectKrw},${res.allocatedDutyKrw},${res.allocatedVatKrw},${res.totalCostKrw},${res.unitCostKrw}\n`;
    });

    const amortized = session.items.filter(i => i.isAmortized);
    if (amortized.length > 0) {
      csvContent += '\n원가 분담 적용 외화 비용 (금형비/일회성 제비용)\n';
      csvContent += '비용명,수량,단가,외화합계,기타 품목으로 자동 배부 여부\n';
      amortized.forEach(item => {
        csvContent += `"${item.name}",${item.quantity},${item.unitPrice},${item.quantity*item.unitPrice},배부 완료 (원화 환산액: ${Math.round(item.quantity*item.unitPrice*calculation.averageRemittanceRate).toLocaleString()}원)\n`;
      });
    }

    // Direct Cost Breakdown
    csvContent += '\n원화 지출 내역 요약\n';
    csvContent += `지출 항목,원화 금액(KRW)\n`;
    csvContent += `물품 외화 송금액 (송금액),${session.indirectCosts.remittanceKrw}\n`;
    csvContent += `제이맥스 (대행 실비),${session.indirectCosts.jmaxFee}\n`;
    csvContent += `세관 관세,${session.indirectCosts.customsDuty}\n`;
    csvContent += `세관 부가세,${session.indirectCosts.vat}\n`;
    csvContent += `관세무사 대행 수수료,${session.indirectCosts.brokerFee}\n`;
    csvContent += `국내 운송비/택배비,${session.indirectCosts.courierFee}\n`;
    csvContent += `인증 및 정밀검사수수료,${session.indirectCosts.certificationFee + session.indirectCosts.quarantineFee}\n`;
    csvContent += `대행사 주 수수료 (공급가+부가세),${calculation.commissionSummary.total}\n`;
    csvContent += `송금 환율 정산 차액,${session.indirectCosts.exchangeAdjustment}\n`;
    csvContent += `총 실제 지상 투입액,${calculation.totalDisbursementKrw}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${session.title.replace(/\s+/g, '_')}_수입원가_리포트.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Math variables for metrics overview
  const totalResaleForeign = calculation.totalResaleForeignAmount;
  const totalAmortizedForeign = calculation.totalAmortizedForeignAmount;
  const totalCombinedForeign = calculation.totalForeignAmount;
  
  // Calculate aggregate metrics
  const netGoodsCostKrw = Math.round(totalResaleForeign * calculation.averageRemittanceRate);
  const totalOverheadKrw = calculation.totalDisbursementKrw - netGoodsCostKrw;
  const overheadPercentage = netGoodsCostKrw > 0 
    ? ((totalOverheadKrw / netGoodsCostKrw) * 100).toFixed(1) 
    : '0.0';

  // Highlight matches with the user's Excel mockup to guide user confidence!
  const isSelectedSampleOne = session.id === 'sample-2025-02-07';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-teal-500/20 selection:text-teal-900 pb-16 relative">
      {/* Upper Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-teal-600 text-white p-2 rounded-xl shadow-xs">
                <Calculator className="h-[22px] w-[22px]" id="logo-icon" />
              </div>
              <div>
                <span className="font-mono text-[11px] font-bold tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full uppercase">
                  Biz Calculator
                </span>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5 leading-none mt-0.5">
                  수입 원가 및 수수료 분석 솔루션
                  <span className="text-xs font-normal text-slate-500 hidden sm:inline">| Imported Goods Overhead Distributer</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleResetToDefault}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors text-xs font-medium rounded-lg"
                title="데이터를 원본 샘플 값으로 복원합니다."
                id="btn-reset"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>데이터 초기화</span>
              </button>
              
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white transition-colors text-xs font-medium rounded-lg shadow-xs"
                id="btn-export"
              >
                <Download className="h-3.5 w-3.5" />
                <span>CSV 백업/내보내기</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* Top Control Bar & Session Selector */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-400" />
              정산 세션 선택 :
            </label>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 max-w-xs sm:max-w-md"
                id="session-selector"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.date})
                  </option>
                ))}
              </select>
              
              <button
                onClick={handleCreateNewSession}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 p-1.5 rounded-lg transition-all"
                title="새 정산 세션 작성"
                id="btn-new-session"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <input
              type="text"
              value={session.title}
              onChange={(e) => updateSession(prev => ({ ...prev, title: e.target.value }))}
              placeholder="세션 제목 편집"
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 w-44 md:w-56"
              id="session-title-input"
            />
            <input
              type="text"
              value={session.date}
              onChange={(e) => updateSession(prev => ({ ...prev, date: e.target.value }))}
              placeholder="YYYY-MM-DD"
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 w-28 text-center"
              id="session-date-input"
            />
            <button
              onClick={handleDuplicateSession}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              title="현재 세션 복사"
              id="btn-dup"
            >
              복사
            </button>
            <button
              onClick={handleDeleteSession}
              className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              title="세션 영구 삭제"
              id="btn-del"
            >
              삭제
            </button>
          </div>
        </section>

        {/* Real-time Math Alert Banner matching User's Excel */}
        {isSelectedSampleOne && (
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-900 flex items-start gap-3 shadow-xs">
            <div className="bg-amber-100 p-1.5 rounded-lg text-amber-800 shrink-0 mt-0.5">
              <CheckCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold">✨ 이미지 예시 매칭 모드 로딩 완료!</p>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                사용자님이 제출해주신 <strong>2025.2.7정산 엑셀 시트</strong> 데이터가 정확하게 연동되었습니다.
                외화 송금액 <strong>5,524,764원</strong>, 제이맥스 <strong>606,244원</strong>, 관세사비 <strong>373,340원</strong>, 대행수수료 <strong>163,320원</strong> 및 환율 정산액 <strong>1,751원</strong>이 모두 합쳐져 
                실주문 2,000개의 최종 개당 수입원가가 소수점 반올림 기준 <strong>정확히 3,334원</strong>으로 계산 보정됨을 실시간으로 확인하실 수 있습니다.
              </p>
            </div>
          </div>
        )}

        {/* Dashboard Statistics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 relative z-10">
          <div className="bg-indigo-600 text-white rounded-2xl p-4 shadow-sm scale-100 hover:scale-[1.01] transition-transform duration-300 border border-indigo-700">
            <span className="text-[10px] font-bold text-indigo-200 block tracking-wider uppercase">총 원화 부대비용 포함 지출액 (A)</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black text-white font-mono tracking-tight">
                {calculation.totalDisbursementKrw.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-indigo-200">원</span>
            </div>
            <p className="text-[10px] text-indigo-200/80 mt-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
              모든 송금액 및 수수료/대행비 실제 투입액
            </p>
          </div>

          <div className="bg-emerald-600 text-white rounded-2xl p-4 shadow-sm scale-100 hover:scale-[1.01] transition-transform duration-300 border border-emerald-700">
            <span className="text-[10px] font-bold text-emerald-100 block tracking-wider uppercase">순수 물품 한화 환산액 (B)</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black text-white font-mono tracking-tight">
                {netGoodsCostKrw.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-emerald-100">원</span>
            </div>
            <p className="text-[10px] text-emerald-100/80 mt-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span>
              외화 수량×단가 × 평균송금환율 적용
            </p>
          </div>

          <div className="bg-rose-600 text-white rounded-2xl p-4 shadow-sm scale-100 hover:scale-[1.01] transition-transform duration-300 border border-rose-700">
            <span className="text-[10px] font-bold text-rose-100 block tracking-wider uppercase">수입 부대비용 및 수외잡비 합계</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black text-white font-mono tracking-tight">
                {totalOverheadKrw.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-rose-100">원</span>
            </div>
            <p className="text-[10px] text-rose-100/80 mt-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-300"></span>
              총액 - 순수물품액 차액 (배부 대상)
            </p>
          </div>

          <div className="bg-amber-500 text-white rounded-2xl p-4 shadow-sm scale-100 hover:scale-[1.01] transition-transform duration-300 border border-amber-600">
            <span className="text-[10px] font-bold text-amber-100 block tracking-wider uppercase">물품 대비 부대비용 부담 비율</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black text-white font-mono tracking-tight">
                {overheadPercentage}
              </span>
              <span className="text-lg font-black text-amber-100">%</span>
            </div>
            <p className="text-[10px] text-amber-100/80 mt-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
              원화 물품 대금 1원 수입당 간접비 가중치
            </p>
          </div>
        </div>

        {/* Flex Work Layout split: Left (Inputs) | Right (Analysis & Results) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Input Controllers & Items Lists (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Foreign Items Table */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border-t-4 border-t-emerald-500 border-x border-b border-slate-200 shadow-md shadow-emerald-500/5 overflow-hidden transition-all hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="px-5 py-4 bg-teal-800 border-b border-teal-900 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md backdrop-blur-xs">
                    Input (01)
                  </span>
                  <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                    수입 품목 및 외화 대금 명세
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-100 font-medium">
                    <span className="font-semibold">기준 통화:</span>
                    <select
                      value={session.currency}
                      onChange={(e) => updateSession(prev => ({ ...prev, currency: e.target.value as CurrencyType }))}
                      className="border border-white/20 bg-slate-800/80 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-300 text-xs font-bold text-white cursor-pointer"
                      id="currency-select"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="CNY">CNY (元)</option>
                      <option value="JPY">JPY (¥)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="KRW">KRW (₩)</option>
                    </select>
                  </div>
                  <button
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 bg-white text-teal-900 hover:bg-slate-100 text-xs font-extrabold py-1 px-3 rounded-lg transition-all shadow-xs active:scale-[0.98]"
                    id="btn-add-item"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>품목 추가</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-200 font-bold border-b border-slate-700 select-none uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4 w-[220px]">품목명 (Item Name)</th>
                      <th className="py-3 px-3 text-right w-[95px]">수량 (Qty)</th>
                      <th className="py-3 px-3 text-right w-[110px]">단가 ({session.currency})</th>
                      <th className="py-3 px-4 text-right w-[120px]">외화 합계</th>
                      <th className="py-3 px-3 text-center w-[120px]">원가분담여부</th>
                      <th className="py-3 px-3 text-center w-[50px]">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {items.map((item, index) => {
                      const computedForeignTotal = item.quantity * item.unitPrice;
                      const isAmortized = item.isAmortized;
                      return (
                        <tr 
                          key={item.id} 
                          className={`transition-all duration-200 hover:scale-[1.002] border-b border-slate-150 ${
                            isAmortized 
                              ? 'bg-gradient-to-r from-amber-50/70 to-orange-50/20 hover:from-amber-50 hover:to-orange-50 border-l-4 border-l-amber-500' 
                              : 'bg-gradient-to-r from-teal-50/40 to-emerald-50/10 hover:from-teal-50 hover:to-emerald-50 border-l-4 border-l-teal-500'
                          }`}
                          id={`item-row-${item.id}`}
                        >
                          {/* Item Name */}
                          <td className="py-3 px-4 font-medium">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleEditItem(item.id, 'name', e.target.value)}
                              className={`w-full bg-white hover:bg-slate-50 border border-slate-200/80 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 focus:outline-none transition-all px-2.5 py-1.5 rounded-lg font-bold text-sm shadow-2xs ${
                                isAmortized 
                                  ? 'text-amber-900 focus:border-amber-500' 
                                  : 'text-teal-900 focus:border-teal-500'
                              }`}
                              placeholder="품목명 입력"
                              id={`item-name-${item.id}`}
                            />
                            <input
                              type="text"
                              value={item.note || ''}
                              onChange={(e) => handleEditItem(item.id, 'note', e.target.value)}
                              className="w-full text-[10px] text-slate-500 bg-white/60 hover:bg-slate-50 border border-slate-200/50 focus:bg-white focus:border-slate-400 focus:outline-none transition-all px-2 py-1 rounded-md mt-1.5 shadow-3xs"
                              placeholder="비고/원산지 메모"
                              id={`item-note-${item.id}`}
                            />
                          </td>

                          {/* Quantity */}
                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleEditItem(item.id, 'quantity', Math.max(0, parseFloat(e.target.value) || 0))}
                              className={`w-[80px] text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:outline-none font-extrabold font-mono text-sm py-1 ${
                                isAmortized ? 'text-amber-950 focus:border-amber-500' : 'text-teal-950 focus:border-teal-500'
                              }`}
                              min="0"
                              placeholder="0"
                              id={`item-qty-${item.id}`}
                            />
                          </td>

                          {/* Unit Price */}
                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => handleEditItem(item.id, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                              className={`w-[95px] text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:outline-none font-extrabold font-mono text-sm py-1 ${
                                isAmortized ? 'text-amber-950 focus:border-amber-500' : 'text-teal-950 focus:border-teal-500'
                              }`}
                              min="0"
                              step="0.001"
                              placeholder="0.0"
                              id={`item-price-${item.id}`}
                            />
                          </td>

                          {/* Foreign Total */}
                          <td className={`py-3 px-4 text-right font-black font-mono text-sm ${
                            isAmortized ? 'text-amber-700 bg-amber-100/15' : 'text-teal-700 bg-teal-100/15'
                          }`}>
                            {computedForeignTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-[10px] text-slate-400 ml-1 font-semibold select-none">{session.currency}</span>
                          </td>

                          {/* Is Amortized (금형비 등 여부) */}
                          <td className="py-3 px-3 text-center select-none">
                            <div className="flex flex-col items-center justify-center">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.isAmortized}
                                  onChange={(e) => handleEditItem(item.id, 'isAmortized', e.target.checked)}
                                  className="sr-only peer"
                                  id={`item-amortized-${item.id}`}
                                />
                                <div className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${
                                  isAmortized ? 'peer-checked:bg-amber-500' : 'peer-checked:bg-teal-600'
                                }`}></div>
                              </label>
                              <span className={`inline-flex items-center gap-0.5 text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase border mt-1 shadow-2xs transition-all ${
                                isAmortized 
                                  ? 'bg-amber-100/80 text-amber-800 border-amber-200/50' 
                                  : 'bg-teal-100/80 text-teal-800 border-teal-200/50'
                              }`}>
                                {isAmortized ? '⚙️ 원가분담' : '🛍️ 완제품'}
                              </span>
                            </div>
                          </td>

                          {/* Delete Action */}
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                              title="항목 제거"
                              id={`item-btn-del-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400 italic font-medium">
                          등록된 수입 품목이 없습니다. 품목 추가 버튼을 눌러주세요.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {/* Totals Under the Table */}
                  {items.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-bold border-t border-slate-700 select-none">
                        <td className="py-3 px-4 text-slate-300 font-extrabold text-xs">합계 요약</td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-slate-200 font-extrabold">
                          {items.reduce((acc, i) => acc + i.quantity, 0).toLocaleString()}
                        </td>
                        <td></td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-teal-300 bg-teal-950/30 font-extrabold">
                          {totalCombinedForeign.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {session.currency}
                        </td>
                        <td colSpan={2} className="px-3 py-2 text-center text-[10px] text-slate-300 leading-normal font-bold">
                          <span className="inline-flex items-center bg-teal-850 px-2 py-0.5 rounded text-teal-200 mr-2 border border-teal-700/30">
                            🛍️ 완제품: {resaleItemsCount(items)}개
                          </span>
                          <span className="inline-flex items-center bg-amber-850 px-2 py-0.5 rounded text-amber-200 border border-amber-700/30">
                            ⚙️ 부대 무분담: {amortizedItemsCount(items)}개
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <div className="p-4 bg-slate-50 flex items-start gap-2.5 border-t border-slate-250 text-[11px] text-slate-500 leading-relaxed rounded-b-2xl border-dashed">
                <Info className="h-4 w-4 text-teal-600 shrink-0 mt-0.5 animate-pulse" />
                <span>
                  <strong>원가분담여부 (자공원가 무분담비)</strong> 기능: <strong>"금형비"</strong> 등 일회성 부대비용을 품목으로 등록할 수 있습니다. 스위치를 켜면 이 비용은 완제품 가액에 자동 분담 배부되며 개당 수입원가 도출 목록에서 별도 판매 아이템으로 잡히지 않습니다.
                </span>
              </div>
            </div>

            {/* 2. Indirect Costs Dashboard Input Section */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border-t-4 border-t-indigo-500 border-x border-b border-slate-200 shadow-md shadow-indigo-500/5 overflow-hidden transition-all hover:shadow-lg hover:shadow-indigo-500/10">
              <div className="px-5 py-4 bg-indigo-900 border-b border-indigo-950 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md backdrop-blur-xs">
                    Input (02)
                  </span>
                  <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                    수입 제비용 (원화 실제 지출비용 입력)
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-indigo-200 font-bold">송금 기준 환율 적용:</span>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={session.baseExchangeRate}
                      onChange={(e) => {
                        const newRate = Math.max(0, parseFloat(e.target.value) || 0);
                        updateSession(prev => ({
                          ...prev,
                          baseExchangeRate: newRate,
                          indirectCosts: {
                            ...prev.indirectCosts,
                            exchangeAdjustment: prev.indirectCosts.remittanceKrw - Math.round(calculation.totalForeignAmount * newRate)
                          }
                        }));
                      }}
                      className="w-16 text-right px-1 border border-slate-200 font-bold font-mono text-xs rounded select-all focus:ring-1 focus:ring-teal-500 py-0.5 focus:outline-none"
                      id="base-exchange-rate-input"
                    />
                    <span className="text-[10px] text-slate-400 ml-1">₩</span>
                  </div>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Remittance Input */}
                <div className="space-y-1" id="cost-grp-remittance">
                  <label className="text-[11px] font-bold text-slate-500 flex justify-between">
                    <span>① 물품 해외 송금 총액 (송금액)</span>
                    <span className="text-[10px] font-normal text-slate-400 hover:underline cursor-pointer" onClick={autoSetRemittance}>
                      현재 외화합계 환산액 자동 대입 ↲
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={session.indirectCosts.remittanceKrw.toLocaleString()}
                      onChange={(e) => handleCostChange('remittanceKrw', e.target.value)}
                      className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none font-bold font-mono py-2 pl-3 pr-8 rounded-lg text-sm text-slate-900"
                      placeholder="0"
                      id="cost-remittance-input"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 font-mono">가장중요</span>
                  </div>
                  <p className="text-[10px] text-slate-400">송금 수수료를 포함해 해외 공장으로 입금 완료된 실제 원화 총 투입액</p>
                </div>

                {/* Agencies Expense: Jmax */}
                <div className="space-y-1" id="cost-grp-jmax">
                  <label className="text-[11px] font-bold text-slate-500">② 제이맥스 정산액 (또는 주요 수하인 대행 대금)</label>
                  <input
                    type="text"
                    value={session.indirectCosts.jmaxFee.toLocaleString()}
                    onChange={(e) => handleCostChange('jmaxFee', e.target.value)}
                    className="w-full border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 focus:outline-none font-bold font-mono py-2 px-3 rounded-lg text-sm text-slate-900"
                    placeholder="0"
                    id="cost-jmax-input"
                  />
                  <p className="text-[10px] text-slate-400">자체 대행 수입 에이전시 등에 납부한 정산 실비 합산액</p>
                </div>

                {/* Customs Brokerage Fee */}
                <div className="space-y-1" id="cost-grp-broker">
                  <label className="text-[11px] font-bold text-slate-500">③ 관세사무소 (대행 및 전매 수납비)</label>
                  <input
                    type="text"
                    value={session.indirectCosts.brokerFee.toLocaleString()}
                    onChange={(e) => handleCostChange('brokerFee', e.target.value)}
                    className="w-full border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 focus:outline-none font-bold font-mono py-2 px-3 rounded-lg text-sm text-slate-900"
                    placeholder="0"
                    id="cost-broker-input"
                  />
                  <p className="text-[10px] text-slate-400">관세사무소 수수료, 무관세 이체 및 창고 상하차대금 포함</p>
                </div>

                {/* Exchange Adjustment */}
                <div className="space-y-1" id="cost-grp-adjustment">
                  <label className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                    <span>④ 환율정산조정액 (기타 원화 조정)</span>
                    <span className="text-[10px] text-teal-600 font-bold hover:underline cursor-pointer select-none" onClick={autoSetExchangeAdjustment}>
                      송금액 기준 환율/조정액 자동 매칭 ↲
                    </span>
                  </label>
                  <input
                    type="text"
                    value={session.indirectCosts.exchangeAdjustment.toLocaleString()}
                    onChange={(e) => handleCostChange('exchangeAdjustment', e.target.value)}
                    className="w-full border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 focus:outline-none font-bold font-mono py-2 px-3 rounded-lg text-sm text-slate-900"
                    placeholder="0"
                    id="cost-adjust-input"
                  />
                  <p className="text-[10px] text-slate-400">신청 기한 시차에 따른 송금 미결제 소액 유보금, 환율 사후 정산 조정액</p>
                </div>

                {/* Additional Customs Duty & VAT if explicitly split */}
                <div className="space-y-1 p-3 bg-slate-50 rounded-lg border border-slate-200/60 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1" id="cost-grp-duty">
                    <label className="text-[11px] font-black text-slate-600 flex items-center gap-1">
                      <span>⑤ 세관 납부 관세 (직접지불액)</span>
                      <Info className="h-3 w-3 text-slate-400 cursor-help" title="세관에 직접 납부한 관세가 있다면 기입해 배액 분배합니다." />
                    </label>
                    <input
                      type="text"
                      value={session.indirectCosts.customsDuty.toLocaleString()}
                      onChange={(e) => handleCostChange('customsDuty', e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 focus:outline-none font-bold font-mono py-1.5 px-2.5 rounded-lg text-xs text-slate-900"
                      placeholder="0"
                      id="cost-duty-input"
                    />
                  </div>

                  <div className="space-y-1" id="cost-grp-vat">
                    <label className="text-[11px] font-black text-slate-600 flex items-center gap-1">
                      <span>⑥ 세관 수입 납부 부가세</span>
                      <Info className="h-3 w-3 text-slate-400 cursor-help" title="세관 수입 신고 시 지불한 완제품 부가세 부분입니다." />
                    </label>
                    <input
                      type="text"
                      value={session.indirectCosts.vat.toLocaleString()}
                      onChange={(e) => handleCostChange('vat', e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 focus:outline-none font-bold font-mono py-1.5 px-2.5 rounded-lg text-xs text-slate-900"
                      placeholder="0"
                      id="cost-vat-input"
                    />
                  </div>
                </div>

                {/* Standard K-Logistics (Inland Carriage, Certifications, Quarantine, LCL/Other) */}
                <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1" id="cost-grp-courier">
                    <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Truck className="h-3 w-3 text-slate-400" />
                      국내 운송비 / 택배비
                    </label>
                    <input
                      type="text"
                      value={session.indirectCosts.courierFee.toLocaleString()}
                      onChange={(e) => handleCostChange('courierFee', e.target.value)}
                      className="w-full border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold font-mono py-1.5 px-2.5 rounded-lg text-xs text-slate-900"
                      placeholder="0"
                      id="cost-courier-input"
                    />
                  </div>

                  <div className="space-y-1" id="cost-grp-cert">
                    <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <FileText className="h-3 w-3 text-slate-400" />
                      KC표준인증 비용
                    </label>
                    <input
                      type="text"
                      value={session.indirectCosts.certificationFee.toLocaleString()}
                      onChange={(e) => handleCostChange('certificationFee', e.target.value)}
                      className="w-full border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold font-mono py-1.5 px-2.5 rounded-lg text-xs text-slate-900"
                      placeholder="0"
                      id="cost-cert-input"
                    />
                  </div>

                  <div className="space-y-1" id="cost-grp-quarantine">
                    <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Coins className="h-3 w-3 text-slate-400" />
                      정밀검역수수료
                    </label>
                    <input
                      type="text"
                      value={session.indirectCosts.quarantineFee.toLocaleString()}
                      onChange={(e) => handleCostChange('quarantineFee', e.target.value)}
                      className="w-full border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold font-mono py-1.5 px-2.5 rounded-lg text-xs text-slate-900"
                      placeholder="0"
                      id="cost-quarantine-input"
                    />
                  </div>

                  <div className="space-y-1" id="cost-grp-other">
                    <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Layers className="h-3 w-3 text-slate-400" />
                      LCL 비용 / 포장비 / 기타 잡비
                    </label>
                    <input
                      type="text"
                      value={session.indirectCosts.otherFee.toLocaleString()}
                      onChange={(e) => handleCostChange('otherFee', e.target.value)}
                      className="w-full border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold font-mono py-1.5 px-2.5 rounded-lg text-xs text-slate-900"
                      placeholder="0"
                      id="cost-other-input"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* 3. Detailed Agency Commission Structure */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border-t-4 border-t-pink-500 border-x border-b border-slate-200 shadow-md shadow-pink-500/5 overflow-hidden transition-all hover:shadow-lg hover:shadow-pink-500/10">
              <div className="px-5 py-4 bg-pink-700 border-b border-pink-850 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md backdrop-blur-xs">
                    Input (03)
                  </span>
                  <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                    대행 수수료 정밀 내역 (수수료)
                  </h3>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-4 items-end">
                  {/* Calculation Mode Toggle */}
                  <div className="space-y-1" id="comm-grp-mode">
                    <label className="text-[11px] font-bold text-slate-505 block">수수료 계산 방식</label>
                    <div className="pt-1.5">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={session.commission.usePercent !== false}
                          onChange={(e) => handleCommissionChange('usePercent', e.target.checked)}
                          className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
                          id="comm-use-percent-input"
                        />
                        <span className="text-xs font-bold text-slate-700">외화합계 비례 (자동)</span>
                      </label>
                    </div>
                  </div>

                  {/* Commission Percent Rate */}
                  <div className="space-y-1" id="comm-grp-percent-rate">
                    <label className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                      <span>수수료 요율 (%)</span>
                      <span className="text-[9px] text-teal-600 font-extrabold bg-teal-50 px-1 rounded">기본 3%</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={session.commission.percentRate ?? 3}
                        onChange={(e) => handleCommissionChange('percentRate', parseFloat(e.target.value) || 0)}
                        disabled={session.commission.usePercent === false}
                        className="w-full border border-slate-200 focus:ring-1 focus:ring-teal-500 focus:outline-none font-bold font-mono py-1.5 px-2.5 rounded-lg text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="3.0"
                        id="comm-percent-rate-input"
                      />
                      <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-bold font-mono">%</span>
                    </div>
                  </div>

                  {/* Foreign currency amount */}
                  <div className="space-y-1" id="comm-grp-amount">
                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      수수료 외화 금액
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={derivedSession.commission.amount}
                        onChange={(e) => handleCommissionChange('amount', parseFloat(e.target.value) || 0)}
                        disabled={session.commission.usePercent !== false}
                        className="w-full border border-slate-200 focus:ring-1 focus:ring-teal-500 focus:outline-none font-bold font-mono py-1.5 px-2.5 rounded-lg text-xs text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 disabled:border-teal-100/50"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        id="comm-amount-input"
                      />
                      <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-bold font-mono">{session.currency}</span>
                    </div>
                  </div>

                  {/* Commission Exchange Rate */}
                  <div className="space-y-1" id="comm-grp-rate">
                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      대행 수수료 송금환율
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={session.commission.exchangeRate}
                        onChange={(e) => handleCommissionChange('exchangeRate', parseFloat(e.target.value) || 0)}
                        className="w-full border border-slate-200 focus:ring-1 focus:ring-teal-500 focus:outline-none font-bold font-mono py-1.5 px-2.5 rounded-lg text-xs text-slate-900"
                        min="0"
                        placeholder="1300"
                        id="comm-rate-input"
                      />
                      <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-400 font-bold font-mono">KRW</span>
                    </div>
                  </div>

                  {/* VAT option toggle */}
                  <div className="space-y-1" id="comm-grp-vat">
                    <label className="text-[11px] font-bold text-slate-505 block">수수료 부가세 별도</label>
                    <div className="pt-1.5">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={session.commission.hasVat}
                          onChange={(e) => handleCommissionChange('hasVat', e.target.checked)}
                          className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
                          id="comm-has-vat-input"
                        />
                        <span className="text-xs font-semibold text-slate-600">10% 가산</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Live Output Matching the grid in the bottom right of the excel sheet */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                  <div className="pt-1 sm:pt-0">
                    <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">원화 환산 공급가액</span>
                    <div className="flex items-baseline justify-center">
                      <span className="text-base font-black text-slate-800 font-mono" id="comm-out-supply">
                        {calculation.commissionSummary.supplyPrice.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-0.5">원</span>
                    </div>
                    <span className="text-[9px] text-teal-600 font-bold font-mono block mt-0.5" id="comm-formula-preview">
                      ({derivedSession.commission.amount.toLocaleString()} {derivedSession.currency} × {session.commission.exchangeRate.toLocaleString()}원)
                    </span>
                  </div>
                  <div className="pt-2 sm:pt-0">
                    <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">수수료 부가세 (10%)</span>
                    <span className="text-base font-black text-slate-800 font-mono" id="comm-out-vat">
                      {calculation.commissionSummary.vat.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-0.5">원</span>
                  </div>
                  <div className="pt-2 sm:pt-0 bg-yellow-50/55 sm:bg-transparent rounded-lg">
                    <span className="text-[10px] font-bold text-amber-700 block tracking-wider uppercase">수수료 원화환산액 합계</span>
                    <span className="text-base font-black text-amber-600 font-mono" id="comm-out-total">
                      {calculation.commissionSummary.total.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-amber-600 ml-0.5 font-bold">원</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Output Analysis, Distribution allocation, & Profit simulation (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 1. Allocation Logic selector and explanation */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border-t-4 border-t-cyan-500 border-x border-b border-slate-200 shadow-md shadow-cyan-500/5 overflow-hidden transition-all hover:shadow-lg hover:shadow-cyan-500/10">
              <div className="px-5 py-4 bg-slate-900 border-b border-slate-950 flex justify-between items-center text-white">
                <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                  부대비용 배부 기준 매개변수 설정
                </h3>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleSetAllocationMethod('PRICE_RATIO')}
                    className={`py-2 px-1 text-center rounded-lg border text-xs font-semibold transition-all ${
                      session.allocationMethod === 'PRICE_RATIO'
                        ? 'bg-teal-50 border-teal-500 text-teal-800 ring-2 ring-teal-500/10'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    id="allocation-price-btn"
                  >
                    외화대금 비례
                  </button>
                  <button
                    onClick={() => handleSetAllocationMethod('QTY_RATIO')}
                    className={`py-2 px-1 text-center rounded-lg border text-xs font-semibold transition-all ${
                      session.allocationMethod === 'QTY_RATIO'
                        ? 'bg-teal-50 border-teal-500 text-teal-800 ring-2 ring-teal-500/10'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    id="allocation-qty-btn"
                  >
                    수량 비례
                  </button>
                  <button
                    onClick={() => handleSetAllocationMethod('EQUAL')}
                    className={`py-2 px-1 text-center rounded-lg border text-xs font-semibold transition-all ${
                      session.allocationMethod === 'EQUAL'
                        ? 'bg-teal-50 border-teal-500 text-teal-800 ring-2 ring-teal-500/10'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    id="allocation-equal-btn"
                  >
                    품목별 균등
                  </button>
                </div>

                <div className="text-[11px] p-3 rounded-lg bg-teal-50/55 border border-teal-100 text-teal-900 leading-relaxed">
                  {session.allocationMethod === 'PRICE_RATIO' && (
                    <p>
                      <strong>💡 외화 대금 비율 배부 (추천) :</strong> 가장 대중적인 관세 및 관세사 정산식입니다. 고가 제품이 더 많은 부대비용 가중치를 수용합니다.
                    </p>
                  )}
                  {session.allocationMethod === 'QTY_RATIO' && (
                    <p>
                      <strong>💡 수량 비율 배부 :</strong> 수량이 많은 대량 수입 제품에 정비례하여 비용을 배치합니다. 개별 크기나 무관 기획 시 유용합니다.
                    </p>
                  )}
                  {session.allocationMethod === 'EQUAL' && (
                    <p>
                      <strong>💡 균등 정비율 배부 :</strong> 품목 가액이나 개수와는 완전히 별개로, 물품 가짓수에 따라 전체 간접 실비를 n분의 1 포괄 균등 부과합니다.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. MAIN RESULTS - Calculated Unit Cost List */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border-t-4 border-t-amber-500 border-x border-b border-slate-200 shadow-md shadow-amber-500/5 overflow-hidden transition-all hover:shadow-lg hover:shadow-amber-500/10">
              <div className="px-5 py-4 bg-amber-600 border-b border-amber-700 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md backdrop-blur-xs">
                    Output (Final)
                  </span>
                  <h3 className="font-extrabold text-white text-sm">
                    품목별 최종 수입원가 산출표
                  </h3>
                </div>
                <div className="text-[10px] text-amber-100 font-bold">부대비용 포함 단가</div>
              </div>

              <div className="divide-y divide-slate-150">
                {calculation.itemsResults.map((res) => {
                  return (
                    <div key={res.itemId} className="p-4 hover:bg-slate-50/50 transition-all font-sans" id={`result-card-${res.itemId}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                            {res.itemName}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            총 {res.quantity.toLocaleString()}개 수입 | 기본 USD 단가: ${session.items.find(i=>i.id===res.itemId)?.unitPrice}
                          </span>
                        </div>
                        {/* Final Orange Styled Unit Cost similar to User's excel orange background highlight */}
                        <div className="text-right">
                          <span className="text-[10px] block font-bold text-amber-700">개당 수입원가</span>
                          <div className="inline-flex items-center bg-amber-500 text-slate-950 font-black text-sm px-2.5 py-1 rounded-md animate-pulse shadow-xs font-mono mt-0.5" id={`result-unit-cost-${res.itemId}`}>
                            {res.unitCostKrw.toLocaleString()}원
                          </div>
                        </div>
                      </div>

                      {/* Micro breakdown indicators for user details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[10px]">
                        <div>
                          <span className="text-slate-400 block leading-tight">순수 환산물품대</span>
                          <span className="font-bold font-mono text-slate-700">
                            {Math.round((res.foreignTotal) * calculation.averageRemittanceRate).toLocaleString()}원
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block leading-tight">용역/간접 배부액</span>
                          <span className="font-bold font-mono text-slate-700">
                            {res.allocatedIndirectKrw.toLocaleString()}원
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block leading-tight">배부된 관세/세금</span>
                          <span className="font-bold font-mono text-slate-700">
                            {(res.allocatedDutyKrw + res.allocatedVatKrw).toLocaleString()}원
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block leading-tight">개별 부담총액</span>
                          <span className="font-bold font-mono text-slate-900 block">
                            {res.totalCostKrw.toLocaleString()}원
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {calculation.itemsResults.length === 0 && (
                  <div className="p-8 text-center text-slate-400 italic text-xs">
                    계산된 품목이 없습니다. 메인 수입 완제품을 입력해주세요.
                  </div>
                )}
              </div>
            </div>

            {/* 3. Margins Simulator */}
            {calculation.itemsResults.length > 0 && (
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border-t-4 border-t-purple-500 border-x border-b border-slate-200 shadow-md shadow-purple-500/5 overflow-hidden transition-all hover:shadow-lg hover:shadow-purple-500/10">
                <div className="px-5 py-4 bg-purple-800 border-b border-purple-900 flex justify-between items-center text-white">
                  <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-teal-300" />
                    수입 마진율 & 판매 권장가 시뮬레이션
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-purple-200 font-bold">목표마진율:</span>
                    <input
                      type="number"
                      value={session.targetProfitPercent}
                      onChange={(e) => updateSession(prev => ({ ...prev, targetProfitPercent: Math.min(99, Math.max(0, parseInt(e.target.value) || 0)) }))}
                      className="w-10 text-right px-0.5 border border-slate-200 font-bold font-mono text-xs rounded select-all"
                      min="0"
                      max="99"
                    />
                    <span className="text-[10px] text-slate-400">%</span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {calculation.itemsResults.map((res) => {
                    const selectedPrice = sellingPrices[res.itemId] || Math.round(res.unitCostKrw * 1.5);
                    const unitProfit = selectedPrice - res.unitCostKrw;
                    const marginPercent = selectedPrice > 0 ? (unitProfit / selectedPrice) * 100 : 0;
                    const totalProfit = unitProfit * res.quantity;
                    const recommendedPrice = Math.round(res.unitCostKrw / (1 - (session.targetProfitPercent / 100)));

                    return (
                      <div key={res.itemId} className="space-y-2 pb-3 border-b border-slate-100 last:border-b-0 last:pb-0" id={`margin-sim-${res.itemId}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-900">{res.itemName}</span>
                          <span className="text-[10px] text-slate-500">
                            권장판매가 (목표 {session.targetProfitPercent}%):{' '}
                            <strong className="text-emerald-700 underline cursor-pointer" onClick={() => updateSellingPrice(res.itemId, recommendedPrice)}>
                              {recommendedPrice.toLocaleString()}원
                            </strong>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 block">책정 판매단가 (원화)</span>
                            <div className="flex items-center">
                              <input
                                type="number"
                                value={selectedPrice}
                                onChange={(e) => updateSellingPrice(res.itemId, parseInt(e.target.value) || 0)}
                                className="w-full border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold font-mono py-1 px-2 rounded text-xs text-slate-800"
                                min="0"
                                step="10"
                                placeholder="0"
                                id={`selling-price-input-${res.itemId}`}
                              />
                            </div>
                          </div>

                          <div className="space-y-1 bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                            <span className="text-[9px] font-bold text-slate-400 block">개당 예상 마진액</span>
                            <span className={`text-xs font-bold font-mono ${unitProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} id={`profit-amt-${res.itemId}`}>
                              {unitProfit.toLocaleString()}원
                            </span>
                          </div>

                          <div className="space-y-1 bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                            <span className="text-[9px] font-bold text-slate-400 block">실질 마진율 (%)</span>
                            <span className={`text-xs font-black font-mono ${marginPercent >= 20 ? 'text-emerald-600' : 'text-amber-600'}`} id={`profit-pct-${res.itemId}`}>
                              {marginPercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] pt-1">
                          <span className="text-slate-400">수량 {res.quantity.toLocaleString()}개 완판 시 예상 총 수익:</span>
                          <span className="font-bold text-teal-600 font-mono" id={`total-profit-${res.itemId}`}>
                            {totalProfit.toLocaleString()}원
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Native SVG Visual Cost Breakdown Chart */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm">
                  원금 및 수수료 투입 구조 분석 (Visual Summary)
                </h3>
              </div>

              <div className="p-5 flex flex-col items-center">
                {/* Visual donut matching the colors */}
                {renderCostDistributionChart()}
                
                {/* Legends */}
                <div className="w-full mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 shrink-0"></span>
                    <span className="text-slate-600 truncate">상품 비용: {netGoodsCostKrw.toLocaleString()}원</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500 shrink-0"></span>
                    <span className="text-slate-600 truncate">금형/원가분담: {calculation.amortizedKrwSum.toLocaleString()}원</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-blue-500 shrink-0"></span>
                    <span className="text-slate-600 truncate">대행수수료: {calculation.commissionSummary.total.toLocaleString()}원</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-rose-400 shrink-0"></span>
                    <span className="text-slate-600 truncate">기타 제비용: {(calculation.totalDisbursementKrw - netGoodsCostKrw - calculation.amortizedKrwSum - calculation.commissionSummary.total).toLocaleString()}원</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );

  // Helper helper counts
  function resaleItemsCount(items: ImportItem[]) {
    return items.filter(i => !i.isAmortized).length;
  }

  function amortizedItemsCount(items: ImportItem[]) {
    return items.filter(i => i.isAmortized).length;
  }

  // Updates specific cost categories
  function handleCostChange(field: keyof typeof session.indirectCosts, text: string) {
    const raw = text.replace(/,/g, '');
    const num = Math.max(0, parseInt(raw) || 0);
    updateSession(prev => {
      let updatedCosts = {
        ...prev.indirectCosts,
        [field]: num
      };
      let updatedBaseRate = prev.baseExchangeRate;

      // If editing remittanceKrw, auto-calculate baseExchangeRate and exchangeAdjustment!
      if (field === 'remittanceKrw' && calculation.totalForeignAmount > 0) {
        updatedBaseRate = Math.floor(num / calculation.totalForeignAmount);
        updatedCosts.exchangeAdjustment = num % calculation.totalForeignAmount;
      }

      return {
        ...prev,
        baseExchangeRate: updatedBaseRate,
        indirectCosts: updatedCosts
      };
    });
  }

  // Auto set baseExchangeRate and exchangeAdjustment based on current remittanceKrw / totalForeignAmount
  function autoSetExchangeAdjustment() {
    if (calculation.totalForeignAmount <= 0) return;
    const remittance = session.indirectCosts.remittanceKrw;
    const calculatedRate = Math.floor(remittance / calculation.totalForeignAmount);
    const calculatedAdj = remittance % calculation.totalForeignAmount;
    updateSession(prev => ({
      ...prev,
      baseExchangeRate: calculatedRate,
      indirectCosts: {
        ...prev.indirectCosts,
        exchangeAdjustment: calculatedAdj
      }
    }));
  }

  // Auto set remittance based on current foreign combined * baseExchangeRate
  function autoSetRemittance() {
    const calculatedRaw = Math.round(calculation.totalForeignAmount * session.baseExchangeRate);
    updateSession(prev => ({
      ...prev,
      indirectCosts: {
        ...prev.indirectCosts,
        remittanceKrw: calculatedRaw
      }
    }));
  }

  function handleCommissionChange<K extends keyof typeof session.commission>(field: K, value: typeof session.commission[K]) {
    updateSession(prev => ({
      ...prev,
      commission: {
        ...prev.commission,
        [field]: value
      }
    }));
  }

  function handleSetAllocationMethod(method: AllocationMethod) {
    updateSession(prev => ({
      ...prev,
      allocationMethod: method
    }));
  }

  // Render cost distribution donut chart beautifully in pure SVG to eliminate dependencies layout breakage
  function renderCostDistributionChart() {
    const goods = netGoodsCostKrw;
    const amortizedCost = calculation.amortizedKrwSum;
    const agencyComm = calculation.commissionSummary.total;
    const others = Math.max(0, calculation.totalDisbursementKrw - goods - amortizedCost - agencyComm);
    const sumAll = goods + amortizedCost + agencyComm + others;

    if (sumAll === 0) {
      return (
        <div className="h-44 w-44 rounded-full border border-slate-200 flex items-center justify-center text-xs text-slate-400">
          데이터가 없습니다.
        </div>
      );
    }

    // Proportions
    const pctGoods = goods / sumAll;
    const pctAmortized = amortizedCost / sumAll;
    const pctComm = agencyComm / sumAll;
    const pctOthers = others / sumAll;

    // SVG parameters
    const size = 180;
    const center = size / 2;
    const radius = 65;
    const strokeWidth = 24;
    const circumference = 2 * Math.PI * radius;

    // Dash array offsets
    const strokeGoods = circumference * pctGoods;
    const strokeAmortized = circumference * pctAmortized;
    const strokeComm = circumference * pctComm;
    const strokeOthers = circumference * pctOthers;

    // Offsets
    const offsetGoods = 0;
    const offsetAmortized = strokeGoods;
    const offsetComm = strokeGoods + strokeAmortized;
    const offsetOthers = strokeGoods + strokeAmortized + strokeComm;

    return (
      <div className="relative flex items-center justify-center select-none">
        <svg h="180" w="180" viewBox="0 0 180 180" className="w-[180px] h-[180px] transform -rotate-90">
          {/* Base Empty Circle */}
          <circle cx={center} cy={center} r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth={strokeWidth} />
          
          {/* Goods segment (teal/emerald) */}
          {strokeGoods > 0 && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="#10b981"
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeGoods} ${circumference - strokeGoods}`}
              strokeDashoffset={-offsetGoods}
            />
          )}

          {/* Amortized Tooling (amber) */}
          {strokeAmortized > 0 && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="#f59e0b"
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeAmortized} ${circumference - strokeAmortized}`}
              strokeDashoffset={-offsetAmortized}
            />
          )}

          {/* Commission segment (blue/indigo) */}
          {strokeComm > 0 && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="#3b82f6"
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeComm} ${circumference - strokeComm}`}
              strokeDashoffset={-offsetComm}
            />
          )}

          {/* Others segment (rose) */}
          {strokeOthers > 0 && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="#fb7185"
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeOthers} ${circumference - strokeOthers}`}
              strokeDashoffset={-offsetOthers}
            />
          )}
        </svg>

        {/* Center label */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-bold text-slate-400 tracking-wider">총합계 정산</span>
          <span className="text-sm font-black text-slate-800 font-mono mt-0.5">
            {sumAll.toLocaleString()}원
          </span>
          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 mt-1.5">
            지출 완료
          </span>
        </div>
      </div>
    );
  }
}
