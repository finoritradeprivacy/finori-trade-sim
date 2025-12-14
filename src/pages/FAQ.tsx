import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    question: "What is FinoriTrade?",
    answer: "FinoriTrade is a virtual trading simulator where you can practice investing in stocks, cryptocurrencies, and forex without risking real money. It's designed to help you learn trading strategies, understand market dynamics, and build discipline before trading with real capital."
  },
  {
    question: "Is this real trading?",
    answer: "No, FinoriTrade is strictly a simulation. All trades are virtual, and no real money is involved. The platform uses simulated market prices to provide a realistic trading experience for educational purposes only."
  },
  {
    question: "Can I lose real money on FinoriTrade?",
    answer: "Absolutely not. FinoriTrade is 100% risk-free. You start with $100,000 in virtual USDT, and all gains or losses are purely simulated. This allows you to experiment with different strategies without any financial consequences."
  },
  {
    question: "How do I start trading?",
    answer: "Simply create an account, verify your email, and you'll receive $100,000 in virtual USDT to start trading immediately. You can buy and sell assets across crypto, stocks, and forex markets right away."
  },
  {
    question: "How are prices calculated?",
    answer: "Our system generates realistic price movements that simulate actual market behavior, including volatility, trends, and market events. While not connected to real exchanges, the price dynamics are designed to mirror real market conditions."
  },
  {
    question: "What are daily challenges?",
    answer: "Daily challenges are tasks that refresh every 24 hours. Complete them to earn virtual USDT and XP rewards. They range from simple tasks like 'make 2 trades' to more complex ones like 'achieve 2% profit on a single trade'."
  },
  {
    question: "How does the leveling system work?",
    answer: "You earn XP (experience points) for every trade you make. Profitable trades earn 10 XP, while unprofitable trades earn 25 XP (we reward learning from mistakes!). Level 1 requires 1,000 XP, and each subsequent level requires an additional 500 XP."
  },
  {
    question: "What are dividends?",
    answer: "Stock assets pay daily dividends at an annual yield of 4.8% (approximately 0.013% daily). You must own the stock at 00:00 UTC to be eligible for that day's dividend, which is paid at 10:00 UTC."
  },
  {
    question: "Can I reset my account?",
    answer: "Yes, you can reset your account from your Profile page. This will restore your balance to $100,000 USDT, clear all your trading history, and reset your statistics. Your level and XP will remain."
  },
  {
    question: "Is FinoriTrade a broker?",
    answer: "No, FinoriTrade is not a broker and does not provide investment advice. We are purely an educational platform designed to help users practice and improve their trading skills in a risk-free environment."
  },
  {
    question: "How do market news events work?",
    answer: "Market news events are generated periodically and can impact asset prices. Positive news may cause price increases, while negative news can cause declines. These effects are temporary and prices will gradually revert, teaching you that even good news doesn't create infinite momentum."
  },
  {
    question: "Can I trade 24/7?",
    answer: "Yes, the FinoriTrade simulation runs continuously. You can trade at any time, day or night. This allows you to practice and learn at your own pace, whenever it's convenient for you."
  }
];

const FAQ = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gradient">FAQ</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <section className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Frequently Asked Questions</h2>
          <p className="text-muted-foreground">
            Find answers to the most common questions about FinoriTrade.
          </p>
        </section>

        <Card className="p-6 border-glow">
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>

        <section className="mt-8 text-center">
          <Card className="p-6 bg-primary/5 border-primary/20">
            <h3 className="font-semibold mb-2">Still have questions?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Can't find what you're looking for? Reach out to us!
            </p>
            <Button 
              onClick={() => navigate("/contacts")} 
              variant="outline"
            >
              Contact Us
            </Button>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default FAQ;