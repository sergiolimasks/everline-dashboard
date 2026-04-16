import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PoliticaPrivacidade() {
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
            Política de Privacidade
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            Última atualização: 16 de abril de 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mt-0">1. Quem somos</h2>
            <p>
              Esta Política de Privacidade descreve como a{" "}
              <strong>Ever Line Lançamentos Digitais Ltda - EPP</strong>, inscrita no CNPJ
              sob o nº <strong>64.268.398/0001-24</strong> (“Ever Line”, “nós”), coleta,
              utiliza, armazena e protege dados pessoais tratados em{" "}
              <strong>agenciaeverline.com.br</strong> e nos painéis/dashboards
              disponibilizados aos nossos clientes.
            </p>
            <p>
              A Ever Line atua como <strong>controladora</strong> dos dados de cadastro e
              autenticação dos usuários do painel, e como{" "}
              <strong>operadora</strong> dos dados comerciais dos clientes que nos
              contratam para execução de serviços de lançamento digital, tráfego pago e
              análise de performance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">2. Dados que coletamos</h2>
            <ul>
              <li>
                <strong>Cadastro e autenticação:</strong> nome, e-mail e senha
                (armazenada com hash, nunca em texto plano).
              </li>
              <li>
                <strong>Uso do painel:</strong> logs técnicos de acesso (data/hora,
                endereço IP, user-agent do navegador) utilizados para segurança e
                diagnóstico.
              </li>
              <li>
                <strong>Dados comerciais do cliente:</strong> métricas de campanhas,
                leads, vendas e orçamento publicitário fornecidas pelo próprio cliente
                ou importadas de plataformas integradas (ex.: Meta Ads, CRM).
              </li>
            </ul>
            <p>
              <strong>Não coletamos</strong> dados sensíveis (saúde, origem racial,
              orientação sexual, convicção religiosa) e <strong>não trabalhamos com
              menores de idade</strong>. O painel é destinado exclusivamente a
              profissionais e pessoas jurídicas contratantes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">3. Finalidades e bases legais</h2>
            <p>Tratamos dados pessoais para as seguintes finalidades:</p>
            <ul>
              <li>
                <strong>Executar o contrato</strong> firmado com o cliente —
                disponibilizar o painel, gerar relatórios, processar métricas (art. 7º,
                V da LGPD).
              </li>
              <li>
                <strong>Cumprir obrigações legais ou regulatórias</strong> (art. 7º, II
                da LGPD).
              </li>
              <li>
                <strong>Legítimo interesse</strong> para segurança da aplicação,
                prevenção a fraude e melhoria contínua do produto (art. 7º, IX da LGPD).
              </li>
              <li>
                <strong>Consentimento</strong> quando aplicável, por exemplo para envio
                de comunicação comercial opcional (art. 7º, I da LGPD).
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">4. Compartilhamento</h2>
            <p>
              Não vendemos dados pessoais. Compartilhamos dados apenas com{" "}
              <strong>operadores de infraestrutura</strong> necessários à operação do
              serviço (ex.: provedor de hospedagem, serviços em nuvem de autenticação e
              monitoramento) e <strong>autoridades competentes</strong> mediante ordem
              judicial ou requisição legal válida.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">5. Retenção</h2>
            <p>
              Mantemos os dados pelo tempo necessário à prestação do serviço contratado
              e, após o término da relação, pelo prazo de{" "}
              <strong>até 5 anos</strong> para atender obrigações legais e fiscais, ou
              pelo prazo superior exigido por lei. Logs de acesso são mantidos por até{" "}
              <strong>6 meses</strong>, conforme o Marco Civil da Internet.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">6. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais proporcionais ao risco,
              incluindo criptografia em trânsito (HTTPS/TLS), hash de senhas, controle
              de acesso por perfil (admin/cliente), isolamento de dados por cliente e
              backups periódicos. Nenhum sistema é 100% imune a incidentes; em caso de
              violação que implique risco relevante aos titulares, comunicaremos a ANPD
              e os afetados nos termos da LGPD.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">7. Direitos do titular</h2>
            <p>
              Você pode, a qualquer momento, solicitar:
            </p>
            <ul>
              <li>confirmação da existência de tratamento;</li>
              <li>acesso aos seus dados;</li>
              <li>correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>portabilidade a outro fornecedor;</li>
              <li>eliminação dos dados tratados com base no seu consentimento;</li>
              <li>revogação do consentimento.</li>
            </ul>
            <p>
              Para exercer qualquer desses direitos, entre em contato pelo e-mail{" "}
              <a
                href="mailto:contato@agenciaeverline.com.br"
                className="text-primary hover:underline"
              >
                contato@agenciaeverline.com.br
              </a>
              . Responderemos em até 15 dias.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">8. Cookies</h2>
            <p>
              Utilizamos cookies estritamente necessários para manter sua sessão
              autenticada e para funcionamento básico do painel. Não utilizamos cookies
              publicitários de terceiros neste domínio.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold">9. Alterações</h2>
            <p>
              Podemos atualizar esta Política periodicamente. A versão vigente fica
              sempre disponível nesta página, com a data da última revisão no topo.
              Alterações materiais serão comunicadas por e-mail ou dentro do painel.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold">10. Contato</h2>
            <p>
              Ever Line Lançamentos Digitais Ltda - EPP
              <br />
              CNPJ: 64.268.398/0001-24
              <br />
              E-mail:{" "}
              <a
                href="mailto:contato@agenciaeverline.com.br"
                className="text-primary hover:underline"
              >
                contato@agenciaeverline.com.br
              </a>
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
