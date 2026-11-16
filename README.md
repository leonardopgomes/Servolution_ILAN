# Servolution – Escala de Voluntários (ILAN Church)

Site estático para publicar no **GitHub Pages**. Os voluntários escolhem a **data** no calendário (quintas e domingos), o horário e uma vaga em Plaquinha, Visitante, Conexão ou Oferta. O botão **Imprimir** gera o PDF da data escolhida no modelo da escala.

## Arquivos
- `index.html`, `style.css`, `app.js` – o sistema
- `firebase-config.js` – dados do banco online (Firebase) – **você precisa preencher**
- `logo.png` – logo da ILAN (aparece discreta no site e no PDF)

## 1) Configurar o Firebase (banco compartilhado, gratuito)
O GitHub Pages não guarda dados. Sem o Firebase, cada nome fica salvo só no aparelho de quem cadastrou e **não aparece para os outros voluntários** (o site mostra um aviso amarelo no topo enquanto isso acontecer). Com o Firebase, o nome fica gravado na data e na vaga escolhida, para todos.

### Passo a passo
1. Acesse https://console.firebase.google.com (entre com uma conta Google) e clique em **Criar um projeto**. Dê um nome (ex.: `servolution-ilan`). O Google Analytics pode ficar desativado.
2. No menu lateral, abra **Build > Realtime Database** e clique em **Criar banco de dados**. Escolha a localização mais próxima e o modo **bloqueado** (as regras do passo 3 liberam o acesso).
3. Abra a aba **Regras**, apague o conteúdo, cole o texto abaixo e clique em **Publicar**:

```json
{
  "rules": {
    "escala": {
      ".read": true,
      "$data": {
        ".validate": "$data.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)",
        "$hora": {
          ".validate": "$hora.matches(/^(10h|18h|20h)$/)",
          "$slot": {
            ".write": "!data.exists() && newData.exists()",
            ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 40 && $slot.matches(/^(plaquinha|visitante|conexao|oferta)_[1-6]$/)"
          }
        }
      }
    }
  }
}
```

   O que essas regras garantem, **no servidor**:
   - uma vaga só aceita gravação se estiver **vazia**; depois de reservada, ninguém consegue trocar ou apagar o nome pelo site;
   - se duas pessoas tocarem na mesma vaga ao mesmo tempo, só a primeira é gravada;
   - só são aceitos datas, horários e vagas no formato esperado e nomes de até 40 caracteres.

4. Clique na engrenagem ao lado de **Visão geral do projeto > Configurações do projeto**. Em **Seus apps**, clique no ícone **Web (</>)**, dê um apelido ao app e clique em **Registrar app** (não precisa marcar o Firebase Hosting).
5. Copie os valores do bloco `firebaseConfig` mostrado na tela e cole em `firebase-config.js`. O campo `databaseURL` deve estar preenchido (algo como `https://NOME-default-rtdb.firebaseio.com`). Se ele não aparecer no bloco, copie o endereço mostrado no topo da aba **Dados** do Realtime Database.
6. Salve o arquivo e envie ao GitHub (veja abaixo). Pronto: o aviso amarelo some e os nomes passam a aparecer para todos.

> Esses valores do `firebaseConfig` são feitos para ficar públicos no site; quem protege os dados são as regras do passo 3.

### Observações
- Não há PIN: qualquer pessoa com o link pode se cadastrar e imprimir. Serve para uso interno da igreja; não guarde dados sensíveis.
- Como as regras impedem apagar nomes pelo site, **corrigir um cadastro errado** é feito pelo console: Realtime Database > aba **Dados** > `escala` > data > horário > vaga > ícone de exclusão (ou digite o nome correto no lugar).
- As datas antigas ficam guardadas. Para limpar o histórico, exclua os nós de datas passadas no mesmo painel quando quiser.

## 2) Publicar no GitHub Pages
1. Crie um repositório e envie todos os arquivos (incluindo `logo.png`).
2. **Settings > Pages > Deploy from a branch > main / (root)**.
3. Compartilhe o link (ou use o botão "Compartilhar no WhatsApp").
4. Ao atualizar os arquivos, aguarde alguns minutos e recarregue a página (Ctrl+F5 / puxar para atualizar).

## Como funciona
- O calendário mostra só quintas e domingos, de hoje em diante. Quinta: apenas 20h. Domingo: 10h, 18h ou 20h.
- Os nomes ficam gravados na data e na vaga escolhidas, e a lista "Já cadastrados nesta data" mostra todos.
- Vaga ocupada fica bloqueada; só vagas livres aceitam novo nome.
- **Imprimir** gera o PDF da data selecionada: uma página por horário (3 no domingo, 1 na quinta), com **Data** e **Início** (horário do culto) já preenchidos.
- Vagas livres, Ministro, Término, Púlpito, Contagem e todo o Relatório saem em branco, para preenchimento manual.
- A impressão **não apaga** os nomes: o histórico de cada data permanece.
