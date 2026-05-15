import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  Milk, 
  TrendingUp, 
  Stethoscope, 
  BarChart3, 
  Shield, 
  Smartphone,
  CheckCircle2,
  ArrowRight,
  Users,
  Globe
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Milk className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">DairyFlow</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">Features</a>
              <a href="#benefits" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-benefits">Benefits</a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-pricing">Pricing</a>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <a href="/login">
                <Button data-testid="button-login">Sign In</Button>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                India's #1 Dairy Farm Management Software
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Modern Dairy Farm
                <span className="block text-primary">Management Made Simple</span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg">
                Complete ERP solution for dairy farms. Track cattle health, milk production, 
                breeding cycles, inventory, and finances - all in one beautiful, easy-to-use platform.
              </p>
              
              <div className="flex flex-wrap items-center gap-4">
                <a href="/register">
                  <Button size="lg" className="gap-2" data-testid="button-get-started">
                    Get Started Free
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
                <Button variant="outline" size="lg" data-testid="button-demo">
                  Watch Demo
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Free forever for 2 cows
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  No credit card required
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Works offline
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary/5 rounded-3xl blur-3xl"></div>
              <div className="relative bg-card border rounded-2xl p-6 shadow-xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Today's Overview</h3>
                    <span className="text-sm text-muted-foreground">Live Dashboard</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <Milk className="w-4 h-4" />
                        Milk Today
                      </div>
                      <div className="text-2xl font-bold text-foreground">248.5 L</div>
                      <div className="text-xs text-primary">+12% from yesterday</div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <TrendingUp className="w-4 h-4" />
                        Revenue
                      </div>
                      <div className="text-2xl font-bold text-foreground">12,425</div>
                      <div className="text-xs text-primary">This week</div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <Stethoscope className="w-4 h-4" />
                        Health Alerts
                      </div>
                      <div className="text-2xl font-bold text-foreground">2</div>
                      <div className="text-xs text-orange-500">Needs attention</div>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <Users className="w-4 h-4" />
                        Active Cattle
                      </div>
                      <div className="text-2xl font-bold text-foreground">45</div>
                      <div className="text-xs text-muted-foreground">32 milking</div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-primary/10 to-transparent rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-lg">🐄</span>
                      </div>
                      <div>
                        <div className="font-medium text-foreground">Lakshmi #024</div>
                        <div className="text-sm text-muted-foreground">Pregnancy check due tomorrow</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Run a Modern Dairy Farm
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From individual cow tracking to complete financial management, 
              DairyFlow covers every aspect of dairy farm operations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Milk,
                title: "Milk Recording",
                description: "Track daily milk production per cow, FAT/SNF analysis, and automatic yield calculations."
              },
              {
                icon: Stethoscope,
                title: "Health Management",
                description: "Complete health records, vaccination schedules, treatment tracking with withdrawal period alerts."
              },
              {
                icon: TrendingUp,
                title: "Breeding & Reproduction",
                description: "Heat detection, AI records, pregnancy tracking, and calving management with predictions."
              },
              {
                icon: BarChart3,
                title: "Financial Tracking",
                description: "Income and expenses, milk sales, inventory costs, and comprehensive P&L reporting."
              },
              {
                icon: Shield,
                title: "Inventory Control",
                description: "FIFO-based feed and medicine inventory with expiry tracking and reorder alerts."
              },
              {
                icon: Smartphone,
                title: "Works Offline",
                description: "Full functionality without internet. Perfect for remote farms. Syncs when connected."
              }
            ].map((feature, index) => (
              <Card key={index} className="hover-elevate border-transparent hover:border-border transition-colors">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
                Built for Indian Dairy Farmers
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Designed with input from dairy farmers across India. Supports both 
                small family farms and large commercial operations.
              </p>
              
              <div className="space-y-4">
                {[
                  "Multi-language support including Hindi",
                  "GST-compliant invoicing and reports",
                  "WhatsApp notifications for alerts",
                  "Android app works as offline-first PWA",
                  "Labour-friendly simple interface"
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6 text-center">
                <div className="text-4xl font-bold text-primary mb-2">500+</div>
                <div className="text-muted-foreground">Farms Using DairyFlow</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-4xl font-bold text-primary mb-2">50K+</div>
                <div className="text-muted-foreground">Cattle Tracked</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-4xl font-bold text-primary mb-2">99.9%</div>
                <div className="text-muted-foreground">Uptime</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-4xl font-bold text-primary mb-2">24/7</div>
                <div className="text-muted-foreground">Support</div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Start free, upgrade when you're ready
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <Card className="relative">
              <CardContent className="p-6">
                <div className="text-lg font-semibold text-foreground mb-2">Free</div>
                <div className="text-3xl font-bold text-foreground mb-1">0</div>
                <div className="text-muted-foreground mb-6">Forever free</div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Up to 2 cattle
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    30-day rolling history
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Core features
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Offline support
                  </li>
                </ul>
                <a href="/register" className="block">
                  <Button variant="outline" className="w-full" data-testid="button-free-plan">
                    Get Started
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="relative border-primary shadow-lg">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
              <CardContent className="p-6">
                <div className="text-lg font-semibold text-foreground mb-2">Pro</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-foreground">999</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <div className="text-muted-foreground mb-6">Per farm</div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Up to 100 cattle
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Unlimited history
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    All features
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    CSV/PDF exports
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Priority support
                  </li>
                </ul>
                <a href="/register" className="block">
                  <Button className="w-full" data-testid="button-pro-plan">
                    Start 14-day Trial
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="relative">
              <CardContent className="p-6">
                <div className="text-lg font-semibold text-foreground mb-2">Enterprise</div>
                <div className="text-3xl font-bold text-foreground mb-1">Custom</div>
                <div className="text-muted-foreground mb-6">Contact us</div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Unlimited cattle
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Multi-location support
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Advanced accounting
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    API access
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Dedicated support
                  </li>
                </ul>
                <Button variant="outline" className="w-full" data-testid="button-enterprise">
                  Contact Sales
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
            Ready to Modernize Your Dairy Farm?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join hundreds of dairy farmers who are already using DairyFlow 
            to increase productivity and profitability.
          </p>
          <a href="/register">
            <Button size="lg" className="gap-2" data-testid="button-cta">
              Start Your Free Account
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Milk className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">DairyFlow</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="w-4 h-4" />
              Made in India
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
