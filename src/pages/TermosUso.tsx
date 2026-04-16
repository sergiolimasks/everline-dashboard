import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function TermosUso() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80 backdrop-blur-sm">
        <Link to="/" className="text-xl font-bold font-display text-primary tracking-tight">
          Ever Line
        </Link>
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </header>

      <main className="flex-1 px-6 py-12">
        <article className="max-w-3xl mx-auto prose prose-invert prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
          <h1 className="text-4xl md:text-5xl font-bold font-display text-foreground mb-2">
            Termos de Uso
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            Última atualização: 16 de abril de 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mt-0">1. Aceite</h2>
            <p>
              Estes Termos de Uso regulam o acesso e a utilização do site{" "}
              <strong>agenciaeverline.com.br</strong> e dos painéis disponibilizados pela{" "}
              <strong>Ever Line Lançamentos Digitais Ltda - EPP</strong>, CNPJ{" "}
              <strong>64.268.398/0001-24</strong> (“Ever Line”). Ao acessar ou usar a
              plataforma, você declara concordância com estes Termos. Caso não
              concorde, por favor não utilize o serviço.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">2. Do serviço</h2>
            <p>
              A Ever Line oferece um painel web de acompanhamento de performance de
              campanhas digitais, leads e vendas, destinado a clientes contratantes dos
              serviços de lançamento e tráfego pago da agência. O acesso é concedido
              mediante credenciais individuais, não transferíveis, vinculadas ao
              contrato comercial firmado.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">3. Cadastro e conta</h2>
            <ul>
              <li>
                O usuário é responsável por manter a confidencialidade de suas
                credenciais e por toda atividade realizada em sua conta.
              </li>
              <li>
                Em caso de suspeita de acesso não autorizado, comunique imediatamente
                pelo e-mail{" "}
                <a
                  href="mailto:contato@agenciaeverline.com.br"
                  className="text-primary hover:underline"
                >
                  contato@agenciaeverline.com.br
                </a>
                .
              </li>
              <li>
                É vedado criar conta com informações falsas ou em nome de terceiros sem
                autorização.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">4. Uso aceitável</h2>
            <p>O usuário concorda em <strong>não</strong>:</p>
            <ul>
              <li>
                usar o serviço para fins ilícitos ou que violem direitos de terceiros;
              </li>
              <li>
                tentar acessar áreas restritas, burlar controles de segurança ou
                mecanismos de autenticação;
              </li>
              <li>
                realizar engenharia reversa, raspagem automatizada em larga escala ou
                ataques de negação de serviço;
              </li>
              <li>
                redistribuir, revender ou expor publicamente dados do painel sem
                autorização expressa.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">5. Propriedade intelectual</h2>
            <p>
              O layout, código-fonte, logotipos, textos, relatórios e demais elementos
              da plataforma são de titularidade da Ever Line ou de seus licenciadores.
              O uso do serviço não transfere qualquer direito de propriedade
              intelectual ao usuário, ressalvado o direito de utilização pessoal e
              profissional dentro dos limites contratados.
            </p>
            <p>
              Os <strong>dados comerciais</strong> do cliente (campanhas, leads, vendas)
              permanecem de titularidade do próprio cliente.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">6. Disponibilidade</h2>
            <p>
              Buscamos manter o serviço disponível 24/7, porém não garantimos
              disponibilidade ininterrupta. Manutenções programadas serão comunicadas
              com antecedência razoável sempre que possível. Não nos responsabilizamos
              por indisponibilidades causadas por força maior, falhas de internet do
              usuário ou de provedores de terceiros.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">7. Limitação de responsabilidade</h2>
            <p>
              Na máxima extensão permitida pela legislação aplicável, a Ever Line não
              responde por danos indiretos, lucros cessantes, perda de oportunidade
              comercial ou de dados que decorram do uso ou indisponibilidade do
              serviço. A responsabilidade agregada da Ever Line fica limitada ao valor
              efetivamente pago pelo cliente nos 12 meses anteriores ao evento que
              originou a reclamação.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">8. Privacidade</h2>
            <p>
              O tratamento de dados pessoais no âmbito da plataforma é regido pela
              nossa{" "}
              <Link to="/politica-de-privacidade" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
              , que faz parte integrante destes Termos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">9. Encerramento</h2>
            <p>
              A Ever Line pode suspender ou encerrar o acesso em caso de violação
              destes Termos, término do contrato comercial com o cliente, ou por
              inatividade prolongada. O usuário pode solicitar o encerramento da sua
              conta a qualquer momento pelo canal de contato.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">10. Alterações</h2>
            <p>
              Estes Termos podem ser atualizados periodicamente. A versão vigente fica
              sempre disponível nesta página, com a data da última revisão no topo.
              Mudanças materiais serão comunicadas por e-mail ou dentro do painel.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold">11. Foro e lei aplicável</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil.
              Fica eleito o foro da Comarca de São Paulo/SP para dirimir controvérsias,
              salvo disposição legal em contrário.
            </p>
          </section>
        </article>
      </main>

      <footer className="px-6 py-5 border-t border-border bg-card/80 text-center">
        <p className="text-xs text-muted-foreground">
          CNPJ: 64.268.398/0001-24 — Ever Line Lançamentos Digitais Ltda - EPP
        </p>
      </footer>
    </div>
  );
}
