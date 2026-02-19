export default function CTA() {
  return (
    <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="gradient-bg rounded-3xl p-12 text-center shadow-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            LLMの品質と安全性を今すぐ向上
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            無料デモでLLM Trace Lensの効果を体感してください。
            導入のご相談も承ります。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#demo"
              className="bg-white text-primary-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              無料デモを申し込む
            </a>
            <a
              href="mailto:contact@example.com"
              className="text-white border-2 border-white/50 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/10 transition-colors"
            >
              お問い合わせ
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
