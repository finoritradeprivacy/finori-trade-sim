import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, BookOpen, BarChart3, Shield, RefreshCw, Star, Quote } from "lucide-react";
import { useNavigate } from "react-router-dom";

const coreValues = [
  {
    icon: Target,
    title: "Transparency",
    description: "No hidden rules, no fake results"
  },
  {
    icon: BookOpen,
    title: "Education over hype",
    description: "Learning before profit"
  },
  {
    icon: BarChart3,
    title: "Realistic simulation",
    description: "Market logic over arcade mechanics"
  },
  {
    icon: Shield,
    title: "User safety",
    description: "No real money, no pressure"
  },
  {
    icon: RefreshCw,
    title: "Continuous improvement",
    description: "Data, feedback, iteration"
  }
];

const team = [
  {
    name: "Petr Bača",
    role: "Managing Director and Owner",
    initials: "PB"
  },
  {
    name: "Filip Bača",
    role: "Development Consultant, Web Designer and Developer",
    initials: "FB"
  },
  {
    name: "Honza Rydzoň",
    role: "Social Media Manager",
    initials: "HR"
  }
];

const reviews = [
  {
    name: "Michael T.",
    rating: 5,
    text: "FinoriTrade completely changed how I approach trading. I practiced here for 3 months before going live, and it made all the difference.",
    short: false
  },
  {
    name: "Sarah K.",
    rating: 5,
    text: "Finally a simulator that feels real! The market dynamics are spot on.",
    short: true
  },
  {
    name: "David R.",
    rating: 5,
    text: "I've tried many trading simulators, but FinoriTrade stands out with its transparency and realistic price movements. The daily challenges keep me motivated to learn more every day.",
    short: false
  },
  {
    name: "Emma L.",
    rating: 4,
    text: "Great for beginners! The risk-free environment helped me understand market basics.",
    short: true
  },
  {
    name: "James P.",
    rating: 5,
    text: "The leveling system and challenges make learning trading actually fun. I've improved my win rate significantly since I started practicing here.",
    short: false
  },
  {
    name: "Anna M.",
    rating: 5,
    text: "Love the clean interface and real-time updates. Feels like a real trading platform!",
    short: true
  },
  {
    name: "Robert H.",
    rating: 5,
    text: "As someone who lost money on real trades before understanding the market, I wish I had found FinoriTrade earlier. It teaches you discipline without the financial pain.",
    short: false
  },
  {
    name: "Lisa W.",
    rating: 4,
    text: "Perfect for testing strategies before using real money. Highly recommended!",
    short: true
  },
  {
    name: "Chris B.",
    rating: 5,
    text: "The news events and market simulations are incredibly realistic. This platform truly prepares you for real trading scenarios.",
    short: false
  },
  {
    name: "Jennifer S.",
    rating: 5,
    text: "Best trading education tool I've used. The team clearly cares about user experience.",
    short: true
  }
];

const About = () => {
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
            <h1 className="text-2xl font-bold text-gradient">About Us</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Mission Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
          <Card className="p-6 border-glow">
            <p className="text-lg leading-relaxed text-muted-foreground mb-4">
              FinoriTrade was created to provide a realistic and transparent trading simulation environment 
              where users can practice investing, test strategies, and build discipline without risking real money.
            </p>
            <p className="text-lg leading-relaxed text-muted-foreground mb-4">
              We believe that long-term success in trading is not about luck or promises of fast profit, 
              but about understanding markets, managing risk, and learning from data.
            </p>
            <p className="text-lg leading-relaxed text-muted-foreground">
              FinoriTrade is not a broker and does not provide investment advice. Our goal is education 
              through simulation — helping users improve their decision-making skills in a safe, controlled environment.
            </p>
          </Card>
        </section>

        {/* Core Values Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Our Values</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coreValues.map((value, index) => (
              <Card key={index} className="p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <value.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{value.title}</h3>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Team Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Our Team</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {team.map((member, index) => (
              <Card key={index} className="p-6 text-center hover:border-primary/50 transition-colors">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">{member.initials}</span>
                </div>
                <h3 className="font-semibold text-lg">{member.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{member.role}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Reviews Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">What Our Users Say</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {reviews.map((review, index) => (
              <Card key={index} className={`p-5 hover:border-primary/50 transition-colors ${review.short ? '' : 'sm:col-span-1'}`}>
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-4 h-4 ${i < review.rating ? 'text-warning fill-warning' : 'text-muted'}`} 
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Quote className="w-4 h-4 text-primary/50 flex-shrink-0 mt-1" />
                  <p className="text-muted-foreground italic">{review.text}</p>
                </div>
                <p className="text-sm font-medium mt-3">— {review.name}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <Card className="p-8 border-glow bg-primary/5">
            <h2 className="text-2xl font-bold mb-3">Ready to Start Learning?</h2>
            <p className="text-muted-foreground mb-6">
              Join thousands of users practicing their trading skills risk-free.
            </p>
            <Button 
              onClick={() => navigate("/auth")} 
              className="gradient-purple glow-purple px-8"
            >
              Get Started
            </Button>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default About;