import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, ExternalLink, Instagram, Youtube, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const socialLinks = [
  {
    name: "Instagram",
    icon: Instagram,
    url: "https://instagram.com/finoritrade",
    handle: "@finoritrade",
    bgColor: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400"
  },
  {
    name: "YouTube",
    icon: Youtube,
    url: "https://youtube.com/@finoritrade",
    handle: "@finoritrade",
    bgColor: "bg-red-600"
  },
  {
    name: "Discord",
    icon: MessageCircle,
    url: "https://discord.gg/9smFbw99",
    handle: "Join our community",
    bgColor: "bg-indigo-600"
  }
];

const Contacts = () => {
  const navigate = useNavigate();

  const handleSocialClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gradient">Contacts</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Email Section */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Get in Touch</h2>
          <Card className="p-6 border-glow">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Email Us</h3>
                <a 
                  href="mailto:finoritrade.privacy@gmail.com"
                  className="text-primary hover:underline"
                >
                  finoritrade.privacy@gmail.com
                </a>
              </div>
            </div>
          </Card>
        </section>

        {/* Social Media Section */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Follow Us</h2>
          <div className="space-y-3">
            {socialLinks.map((social, index) => (
              <Card key={index} className="hover:border-primary/50 transition-colors">
                <button 
                  onClick={() => handleSocialClick(social.url)}
                  className="flex items-center gap-4 p-4 w-full text-left"
                >
                  <div className={`p-2 rounded-full ${social.bgColor}`}>
                    <social.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{social.name}</h3>
                    <p className="text-sm text-muted-foreground">{social.handle}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </button>
              </Card>
            ))}
          </div>
        </section>

        {/* Info Section */}
        <section>
          <Card className="p-6 bg-primary/5 border-primary/20">
            <h3 className="font-semibold mb-2">Need Help?</h3>
            <p className="text-sm text-muted-foreground">
              For questions about the platform, trading simulation, or technical issues, 
              please email us or join our Discord community for faster responses.
            </p>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Contacts;