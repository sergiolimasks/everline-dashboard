import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import banner1 from "@/assets/banner-1.jpg";
import banner2 from "@/assets/banner-2.jpg";
import banner3 from "@/assets/banner-3.jpg";
import banner4 from "@/assets/banner-4.jpg";

const slides = [
  { image: banner1, title: "Performance Digital", subtitle: "Dados reais para decisões inteligentes" },
  { image: banner2, title: "Escale Seus Resultados", subtitle: "Estratégias baseadas em métricas que importam" },
  { image: banner3, title: "Conexões que Convertem", subtitle: "Tráfego qualificado com inteligência de dados" },
  { image: banner4, title: "Crescimento Consistente", subtitle: "Acompanhe cada passo da sua evolução" },
];

export default function Home() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80 backdrop-blur-sm">
        <span className="text-xl font-bold font-display text-primary tracking-tight">Ever Line</span>
        <Link
          to="/login"
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <LogIn className="h-4 w-4" />
          Entrar
        </Link>
      </header>

      {/* Banner Carousel */}
      <main className="flex-1 relative overflow-hidden">
        {slides.map((slide, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === current ? 1 : 0 }}
          >
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <h2 className="text-4xl md:text-6xl font-bold font-display text-foreground mb-4 drop-shadow-lg">
                {slide.title}
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl drop-shadow-md">
                {slide.subtitle}
              </p>
            </div>
          </div>
        ))}

        {/* Dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-3 h-3 rounded-full transition-all ${
                i === current ? "bg-primary scale-125" : "bg-muted-foreground/40"
              }`}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-5 border-t border-border bg-card/80">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 max-w-6xl mx-auto">
          <p className="text-xs text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} Ever Line Lançamentos Digitais Ltda - EPP — CNPJ: 64.268.398/0001-24
          </p>
          <nav className="flex items-center gap-5 text-xs">
            <Link to="/politica-de-privacidade" className="text-muted-foreground hover:text-primary transition-colors">
              Política de Privacidade
            </Link>
            <span className="text-muted-foreground/40">·</span>
            <Link to="/termos-de-uso" className="text-muted-foreground hover:text-primary transition-colors">
              Termos de Uso
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
