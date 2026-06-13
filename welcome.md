# Estudo de Caso: Criação, Implementação e Segurança de um Sistema de Gestão de Tarefas Pessoais

## Introdução

Neste estudo de caso, assumiremos o papel de um desenvolvedor individual encarregado de criar, implementar e assegurar a segurança de um sistema simples de gerenciamento de tarefas pessoais, aplicando conceitos de Introdução ao SDLC, Modelos e Metodologias SDLC, Introdução ao DevOps, Desenvolvimento Seguro de Software, Containers e Docker, e DevSecOps.

## Etapa 1: Planejamento e Definição de Requisitos

Iniciar um projeto de desenvolvimento de software sem um entendimento claro dos requisitos é como iniciar uma viagem sem um destino em mente. Portanto, sua primeira tarefa é analisar e entender os requisitos do sistema de gerenciamento de tarefas pessoais.

**Análise de Requisitos**

* Comece fazendo uma lista dos requisitos que você acredita serem necessários para o sistema de gerenciamento de tarefas pessoais. Por exemplo, o sistema deve ser capaz de autenticar os usuarios, permitir que os usuários criem, editem, excluam e visualizem suas tarefas, permitir que os usuários pesquisem tarefas por palavras-chave,etc.
* Requisitos obrigatórios:
* autenticação é obrigatoria antes de qualquer ação
* aplicação deve gerar log de suas atividades via syslog, bem como sucesso ou fracasso nas autenticações

**Requisitos Funcionais e Não Funcionais**

* Depois de identificar os requisitos, divida-os em requisitos funcionais e não funcionais.
* Requisitos funcionais são características que o sistema deve ter para cumprir sua função (por exemplo, processar pedidos).
* Requisitos não funcionais são características relacionadas ao desempenho do sistema, como velocidade, segurança e usabilidade.

**Casos de Uso e Fluxos de Sistema**

* Em seguida, crie casos de uso para descrever como os usuários interagem com o sistema. Por exemplo, um caso de uso pode ser "Usuário faz um pedido".
* Além disso, desenhe fluxos de sistema para mostrar como as diferentes partes do sistema interagem entre si.

**Ameaças de Segurança e Medidas de Mitigação**

* Por último, mas não menos importante, pense nas possíveis ameaças de segurança que o sistema pode enfrentar e como mitigá-las. Por exemplo:
* como você protegerá os dados dos usuários?
* Como evitará ataques de negação de serviço?
* o que será gerado nos logs como violação de segurança?
* Esta etapa é crucial para garantir que o sistema seja seguro e confiável.

## Etapa 2: Desenvolvimento do Sistema

Nesta etapa, você deve analisar o codigo-fonte base fornecido para o sistema e adaptá-lo ou modificá-lo de modo que possa ser executado em um container Docker. Em um exercício real também seria necessário adaptar o código aos requisitos identificados na etapa 1 porém, adaptaremos apenas o ambiente de execução em container, sem necessariamente implementar todos os requisitos definidos na Etapa 1. Confira as versões e atualizações das ferramentas compatíveis com aplicação.

* Certifique-se de que o Python e Flask estão instalados no seu ambiente de desenvolvimento.
* Em seguida, baixe e execute a aplicação base de gerenciamento de tarefas pessoais, usando python e flask. É opcional se quiser adaptar conforme os requisitos especificados na etapa 1.
* git clone <https://github.com/AdityaBagad/Task-Manager-using-Flask.git>
* pip3 install -r requirements.txt
* python run.py

## Etapa 3: Criação de um pipeline CI/CD

Após criada e testada inicialmente a aplicação, voce deve iniciar a criação um pipeline CI/CD usando o GitLab, como visto nas atividades práticas.

**Obs: Caso sua máquina tenha 8Gb ou menos de memória, utilize o GitHub Action ao invés do Gitlab**

O pipeline CI/CD deve contemplar inicialmente:

* Controle de versão com Git: Todo o código-fonte deve estar armazenado em um repositório Gitlab, usando tags para marcar versões específicas do código, com ramificações dedicadas para produção, estágio e desenvolvimento.
* Integração Contínua (CI):
* Compilação/interpretação: O código deve ser automaticamente compilado/interpretado a cada commit para assegurar a consistência do ambiente, ou seja, fazer a validação do build, verificar dependências e execução correta do ambiente a cada commit.
* Testes Automatizados: Realizar os Testes unitários, de integração e funcionais são executados.

## Etapa 4: Análise Estática de Código (SAST)

A análise estática de segurança (SAST, na sigla em inglês) é fundamentais para garantir a segurança da aplicação. A SAST envolve a análise estática e de dependencia do código fonte da aplicação em busca de vulnerabilidades.

Para a análise estática, utilize uma ferramenta chamada Bandit, que é uma ferramenta de análise de segurança Python.

Para uma análise de dependencias em Python, pode-se usar o OWASP Dependency-Check ou ferramentas específicas como Safety/pip-audit, para identificar bibliotecas desatualizadas ou com falhas de segurança.

Inclua no pipeline CI/CD essa etapa de SAST:

* Análise Estática de Código
* uso do Bandit para analisar o código em busca de vulnerabilidades.
* Análise de Dependência
* uso do Owasp Dependency-check

## Etapa 5: Análise Dinâmica de Segurança (DAST)

Para a análise dinâmica, utilize o OAWSP ZAP na aplicação, que deve estar em execução em um container Docker.

* Certifique-se de que a aplicação esteja em execução.
* Inicie o Zed Attack Proxy (ZAP), uma ferramenta gratuita de testes de penetração que busca vulnerabilidades em aplicações web, a partir de uma imagem docker.
* Configure o ZAP para usar o quick start, apontando para o endereço da aplicação (por exemplo, <http://192.168.98.10:8080>). O modo Quick Start do ZAP realiza varredura automatizada. Caso deseje integrar ao pipeline, utilize o ZAP CLI ou o ZAP Baseline Scan em modo headless.
* Inicie a verificação de segurança.
* Após a verificação, o ZAP fornecerá um relatório detalhado de possíveis problemas de segurança.

Após essa etapa, você deve ter uma boa compreensão de como está a qualidade do código e a segurança da sua aplicação.

Lembre-se de corrigir os problemas encontrados e repetir os testes até que todos passem e a aplicação esteja segura.

## Etapa 6: Entrega Contínua (CD)

Acrescente no pipeline CI/CD, a fase de Entrega Contínua (CD):

* Review - reexecução no ambiente de stage:
* Para cada merge request, um ambiente temporário de revisão é criado automaticamente para avaliação manual.
* Deploy em Estágio:
* Para posterior aprovação, o código é implantado no ambiente de stage para simular a produção
* Testes de Segurança de Aplicação Dinâmicos (DAST), ou seja, repetir os testes DAST no ambiente de stage para validar segurança pós-deploy.
* O OWASP ZAP é usado para realizar testes de segurança no ambiente de stage.

## Etapa 7: Feedback e Monitoramento

Pesquise por ferramentas de monitoramento que possam analisar o log da aplicação e fornecer alertas imediatos de qualquer anomalia (por exemplo, tentativa de quebra de senha por força bruta). Pode revisar ferramentas já utilizadas anteriormente ou analisar novas opções.

Inclua no pipeline esse monitoramento Pós-Implantação:

* Instalação de ferramentas que monitoram a aplicação em produção para detectar problemas. Ex.: Prometheus + Grafana, Wazuh ou ELK Stack para análise de logs e alertas de anomalia.

## Etapa 8: Documentação e Entrega Final

Por fim, documente o processo de desenvolvimento, implementação e segurança do sistema. Elabore um relatório final seguindo o padrão adotado nas atividades anteriores, com sumário, cabeçalho e prints das telas.

O relatório deve ter, no máximo, 12 páginas, apresentando de forma resumida a elaboração do projeto descrito na Etapa 1. Além disso, a partir da Etapa 2, um print do resultado mais relevante de cada etapa. Após o sumário de cada etapa, uma breve descrição das ferramentas utilizadas, os resultados alcançados e as lições aprendidas.

Inclua também no relatório a versão final do pipeline CI/CD, com o conteúdo do arquivo .gitlab-ci.yml copiado em formato textual dentro do PDF, a fim de documentar o pipeline e demonstrar o uso prático do CI/CD. Não enviar o arquivo .yml separado, pois sua inclusão textual no relatório já serve como evidência técnica da configuração realizada.

## Tarefa a Entregar

Entregue o relatório final, em PDF.

## Conclusão

Ao longo deste estudo de caso, tivemos a oportunidade de aplicar uma variedade de habilidades e conceitos importantes, desde o planejamento e design de um sistema até sua implementação e monitoramento contínuo. Este processo nos ajudou a entender melhor os desafios do desenvolvimento de software seguro e eficiente e nos preparou melhor para enfrentar esses desafios no futuro.
