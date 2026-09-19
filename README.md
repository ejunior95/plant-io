# Plant.io — Mapeamento de áreas de plantio de mudas

Aplicação web para delimitar áreas de plantio sobre um mapa, medir sua extensão
e acompanhar a situação de cada talhão.

O usuário navega até a região desejada, marca os vértices da área clicando no
mapa e recebe imediatamente a área em hectares e o perímetro em metros. Cada
polígono é salvo com nome, espécie, situação e observações.

## Funcionalidades

- **Desenho de áreas** — marcação de vértices por clique, com ajuste por arraste
  e remoção individual de pontos.
- **Medição geodésica** — cálculo de área e perímetro sobre a superfície
  terrestre, atualizado em tempo real enquanto o polígono é desenhado.
- **Cadastro** — nome, espécie/cultura, situação (planejada, em plantio,
  plantada, concluída) e observações livres por área.
- **Edição e exclusão** — o polígono salvo pode ser redesenhado depois.
- **Busca de locais** — pesquisa por município ou endereço e centralização na
  posição do dispositivo, para chegar rapidamente à região do plantio.
- **Painel de totais** — quantidade de áreas e área total mapeada.

## Tecnologias

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | Next.js 16 (App Router) | Renderização no servidor e Server Actions dispensam uma API REST separada |
| Linguagem | TypeScript | Tipagem compartilhada entre servidor e navegador |
| Mapa | Leaflet + OpenStreetMap | Gratuito e sem necessidade de chave de API |
| Banco | SQLite via Prisma | Arquivo local: o projeto roda sem instalar servidor de banco |
| Validação | Zod | Mesmo esquema descreve o formato e as mensagens de erro |
| Estilo | Tailwind CSS v4 | — |

## Como executar

Requisitos: **Node.js 20.19 ou superior**.

```bash
# 1. Instalar as dependências
npm install

# 2. Configurar o caminho do banco
cp .env.example .env

# 3. Criar o banco e aplicar a estrutura de tabelas
npm run db:migrate

# 4. (opcional) Carregar áreas de exemplo para demonstração
npm run db:seed

# 5. Iniciar em modo de desenvolvimento
npm run dev
```

A aplicação fica disponível em <http://localhost:3000>.

### Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Compilação e execução em modo de produção |
| `npm run lint` | Análise estática com ESLint |
| `npm run typecheck` | Verificação de tipos sem gerar arquivos |
| `npm run db:migrate` | Cria e aplica migrações do banco |
| `npm run db:seed` | Recarrega as áreas de exemplo |
| `npm run db:reset` | Apaga e recria o banco do zero |
| `npm run db:studio` | Abre o Prisma Studio para inspecionar os dados |

## Estrutura do projeto

```
app/
  page.tsx                    Página inicial (componente de servidor)
  layout.tsx                  Estrutura HTML e metadados
  actions.ts                  Server Actions: criar, atualizar e excluir áreas
  api/geocode/route.ts        Busca de locais (intermedia o Nominatim)
  components/
    map-workspace.tsx         Orquestra estado, modo de desenho e mutações
    planting-map.tsx          Mapa Leaflet e interação de desenho
    area-form.tsx             Formulário de cadastro com medidas ao vivo
    area-list.tsx             Listagem lateral das áreas
    location-search.tsx       Campo de busca e geolocalização
lib/
  geo.ts                      Cálculos geodésicos e formatação
  areas.ts                    Tipos, situações e validação (Zod)
  queries.ts                  Leitura das áreas do banco
  prisma.ts                   Conexão com o banco
prisma/
  schema.prisma               Definição do modelo de dados
  migrations/                 Histórico de alterações do banco
  seed.ts                     Dados de exemplo
```

## Modelo de dados

O sistema tem uma única entidade, `PlantingArea`:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | String | Identificador gerado automaticamente |
| `name` | String | Nome do talhão |
| `species` | String? | Espécie ou cultura predominante |
| `description` | String? | Observações livres |
| `status` | String | `PLANEJADA`, `EM_PLANTIO`, `PLANTADA` ou `CONCLUIDA` |
| `coordinates` | String | Polígono em JSON: `[[lat, lng], ...]` |
| `areaM2` | Float | Área calculada, em metros quadrados |
| `perimeterM` | Float | Perímetro calculado, em metros |
| `centerLat` / `centerLng` | Float | Centro geométrico, usado para enquadrar o mapa |
| `createdAt` / `updatedAt` | DateTime | Datas de criação e última alteração |

## Decisões técnicas

**Por que o polígono é gravado como texto JSON?**
O SQLite não possui tipos geoespaciais nem listas de valores. Para o volume de
dados deste trabalho, serializar as coordenadas em uma coluna de texto é
suficiente. Um banco PostgreSQL com a extensão PostGIS seria o caminho natural
caso fossem necessárias consultas espaciais — encontrar áreas que se sobrepõem,
por exemplo.

**Por que área e perímetro ficam salvos no banco?**
Evita recalcular todos os polígonos a cada carregamento da listagem. Como são
valores derivados, o servidor os recalcula a partir das coordenadas sempre que
uma área é gravada — nunca confia no número enviado pelo navegador.

**Como a área é calculada?**
Pelo método do excesso esférico (`lib/geo.ts`): cada aresta do polígono
contribui com a área do fuso que projeta sobre o equador, e a soma das
contribuições multiplicada por R²/2 resulta na área delimitada. O resultado foi
conferido contra a fórmula analítica do quadrilátero esférico
`R² · Δλ · (sen φ₂ − sen φ₁)`, com coincidência exata. O perímetro usa a
fórmula de Haversine. Ambos tratam a Terra como esfera de raio 6.378.137 m, o
que é adequado para a escala de um talhão.

**Por que a busca de locais passa pelo servidor?**
A política de uso do Nominatim exige que a aplicação se identifique em cada
requisição. Intermediar a chamada em `app/api/geocode/route.ts` permite enviar
esse cabeçalho e aproveitar o cache do Next.js entre buscas repetidas.

**Por que existe `overrides` no `package.json`?**
O adaptador SQLite do Prisma aceita a versão 12 do `better-sqlite3`, que precisa
compilar código nativo durante a instalação. A versão 13 distribui binários já
compilados para cada sistema operacional, o que torna o `npm install` mais
previsível. O `overrides` faz todas as dependências usarem essa versão.

## Limites conhecidos

- **Sem autenticação**: todas as áreas são públicas e qualquer visitante pode
  editá-las. O sistema pressupõe uso local ou em rede confiável.
- **Sem detecção de sobreposição**: nada impede cadastrar duas áreas que ocupem
  o mesmo terreno.
- **Precisão**: os cálculos tratam a Terra como uma esfera. A diferença em
  relação ao elipsoide WGS84 fica abaixo de 0,5% e é irrelevante na escala de um
  talhão, mas não substitui um levantamento topográfico.

## Créditos

Dados cartográficos por [OpenStreetMap](https://www.openstreetmap.org/copyright)
e colaboradores. Busca de endereços pelo serviço
[Nominatim](https://nominatim.openstreetmap.org/).
