import type { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description:
    'Answers about ordering from Spraxe Bangladesh — advance payment, delivery charges across Bangladesh, payment methods like bKash and Nagad, returns and replacements.',
  alternates: { canonical: '/faq' },
};

const faqs = [
  {
    question: 'Is an advance payment required to place an order?',
    answer: 'Yes. For all electronics products ordered from Spraxe, a partial advance payment is required.',
  },
  {
    question: 'How can I contact customer support?',
    answer: 'You can reach us through our support email, WhatsApp, or hotline number.',
  },
  {
    question: 'Is my personal information safe?',
    answer: 'Yes. We follow strict privacy and security measures to protect your data.',
  },
  {
    question: 'What payment methods are accepted?',
    answer: 'We accept secure online payment methods (Bkash, Nagad) and cash on delivery (if applicable).',
  },
  {
    question: 'How much is the delivery charge?',
    answer:
      'Inside Dhaka City Corporation: 60 BDT\nSavar, Gazipur, Keraniganj: 100 BDT\nAll over Bangladesh: 120 BDT\nNote: Delivery usually takes 2–5 business days depending on your location.',
  },
  {
    question: 'Can I return or replace a product?',
    answer: 'Yes, returns and replacements are available according to our Return Policy.',
  },
];

// FAQ structured data makes these questions eligible to show directly in Google results.
const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer.replace(/\n/g, ' ') },
  })),
};

export default function FAQPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 flex-1">
        <div className="max-w-4xl mx-auto">
          {/* Title Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 text-black">Frequently Asked Questions (FAQ)</h1>
            <p className="text-xl text-gray-600">Find answers to common questions about Spraxe</p>
          </div>

          {/* FAQ Cards */}
          <div className="grid grid-cols-1 gap-6">
            {faqs.map((faq, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-2">
                    {index + 1}. {faq.question}
                  </h2>
                  <p className="text-gray-700 whitespace-pre-line">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
