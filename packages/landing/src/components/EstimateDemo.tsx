import { useState } from 'react';
import { trackDashboardConversion } from '../utils/gtag';

interface LineItem {
  name: string;
  quantity: number;
  unitPrice: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('ja-JP');
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function EstimateDemo() {
  const [clientName, setClientName] = useState('');
  const [subject, setSubject] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { name: '', quantity: 1, unitPrice: '' },
  ]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('月末締め翌月末払い');
  const [showGateModal, setShowGateModal] = useState(false);

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * (Number(item.unitPrice) || 0),
    0,
  );
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { name: '', quantity: 1, unitPrice: '' }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUnitPriceChange = (index: number, raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    updateItem(index, 'unitPrice', digits);
  };

  const openGate = () => setShowGateModal(true);

  return (
    <section id="demo" className="py-16 sm:py-24 px-4 sm:px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-3">
            今すぐ試してみる
          </h2>
          <p className="text-base text-slate-500">
            ログイン不要・無料で見積書を作成できます
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ---- Left: Form ---- */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">見積書の内容</h3>

            {/* 宛先 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                宛先（会社名）
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="株式会社○○"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* 件名 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                件名
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Webサイト制作費用"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* 明細 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-3">
                明細
              </label>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_4rem_6rem_5rem_2rem] gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      placeholder="デザイン費"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-0"
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, 'quantity', Math.max(1, Number(e.target.value) || 1))
                      }
                      className="px-2 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.unitPrice}
                      onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                      placeholder="単価"
                      className="px-2 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="text-sm text-slate-600 text-right tabular-nums truncate">
                      {formatCurrency(item.quantity * (Number(item.unitPrice) || 0))}
                    </span>
                    {items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        aria-label="明細を削除"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    ) : (
                      <div className="w-7" />
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addItem}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                + 明細を追加
              </button>
            </div>

            {/* 計算サマリー */}
            <div className="mb-5 bg-slate-50 rounded-lg p-4 border border-slate-100">
              <div className="flex justify-between text-sm text-slate-600 mb-1.5">
                <span>小計</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}円</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600 mb-1.5">
                <span>消費税 (10%)</span>
                <span className="tabular-nums">{formatCurrency(tax)}円</span>
              </div>
              <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between text-base font-semibold text-slate-900">
                <span>合計</span>
                <span className="tabular-nums">{formatCurrency(total)}円</span>
              </div>
            </div>

            {/* 納期 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                納期
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 支払条件 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                支払条件
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="月末締め翌月末払い">月末締め翌月末払い</option>
                <option value="月末締め翌々月末払い">月末締め翌々月末払い</option>
                <option value="納品後30日以内">納品後30日以内</option>
                <option value="納品後即日">納品後即日</option>
                <option value="前払い">前払い</option>
              </select>
            </div>

            {/* Gate buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={openGate}
                className="flex-1 px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors text-center"
              >
                AIで自動生成する
              </button>
              <button
                type="button"
                onClick={openGate}
                className="flex-1 px-5 py-3 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors text-center"
              >
                AIでチェックする
              </button>
              <button
                type="button"
                onClick={openGate}
                className="flex-1 px-5 py-3 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors text-center"
              >
                PDFダウンロード
              </button>
            </div>
          </div>

          {/* ---- Right: Preview ---- */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm self-start">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 tracking-wide">御見積書</h3>
              <p className="text-xs text-slate-400 mt-1">発行日: {todayString()}</p>
            </div>

            {/* 宛先 */}
            <div className="mb-5 pb-4 border-b border-slate-100">
              <p className="text-sm text-slate-500 mb-0.5">宛先</p>
              <p className="text-base font-medium text-slate-900">
                {clientName || '(未入力)'}{' '}
                <span className="text-slate-400 font-normal">御中</span>
              </p>
            </div>

            {/* 件名 */}
            <div className="mb-5 pb-4 border-b border-slate-100">
              <p className="text-sm text-slate-500 mb-0.5">件名</p>
              <p className="text-base text-slate-900">{subject || '(未入力)'}</p>
            </div>

            {/* 明細テーブル */}
            <div className="mb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-2 text-slate-500 font-medium">品名</th>
                    <th className="text-center py-2 text-slate-500 font-medium w-14">数量</th>
                    <th className="text-right py-2 text-slate-500 font-medium w-20">単価</th>
                    <th className="text-right py-2 text-slate-500 font-medium w-24">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const amount = item.quantity * (Number(item.unitPrice) || 0);
                    return (
                      <tr key={index} className="border-b border-slate-100">
                        <td className="py-2 text-slate-900">{item.name || '---'}</td>
                        <td className="py-2 text-center text-slate-700 tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="py-2 text-right text-slate-700 tabular-nums">
                          {item.unitPrice ? `${formatCurrency(Number(item.unitPrice))}円` : '---'}
                        </td>
                        <td className="py-2 text-right text-slate-900 tabular-nums">
                          {amount > 0 ? `${formatCurrency(amount)}円` : '---'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 合計 */}
            <div className="mb-5 bg-slate-50 rounded-lg p-4">
              <div className="flex justify-between text-sm text-slate-600 mb-1">
                <span>小計</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}円</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600 mb-1">
                <span>消費税 (10%)</span>
                <span className="tabular-nums">{formatCurrency(tax)}円</span>
              </div>
              <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-bold text-slate-900">
                <span>合計</span>
                <span className="tabular-nums text-lg">{formatCurrency(total)}円</span>
              </div>
            </div>

            {/* 支払条件・納期 */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 mb-0.5">支払条件</p>
                <p className="text-slate-900">{paymentTerms}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">納期</p>
                <p className="text-slate-900">{deliveryDate || '(未設定)'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Gate Modal ---- */}
      {showGateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowGateModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="無料登録の案内"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              無料登録でAI機能を使えます
            </h3>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              AIによる見積書の自動生成・品質チェック・PDF出力には無料登録が必要です。
            </p>
            <ul className="space-y-2.5 mb-6">
              {[
                '月額0円・従量課金のみ',
                'クレジットカード不要',
                '30秒で登録完了',
              ].map((point) => (
                <li key={point} className="flex items-center gap-2 text-sm text-slate-700">
                  <svg
                    className="w-4 h-4 text-green-500 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/dashboard"
                onClick={trackDashboardConversion}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors text-center"
              >
                無料で登録する
              </a>
              <button
                type="button"
                onClick={() => setShowGateModal(false)}
                className="flex-1 px-6 py-3 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors text-center"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
