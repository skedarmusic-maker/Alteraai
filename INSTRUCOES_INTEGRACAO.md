# Instruções para Integração com Google Sheets

Para que o aplicativo salve automaticamente as solicitações em uma planilha, siga os passos abaixo:

## P_asso 1: Criar a Planilha
1. Prir um nova planilha no Google Sheets (sheets.new).
2. Na primeira linha (Cabeçalho), adicione os seguintes títulos nas colunas A até H:
   - **A**: Data/Hora
   - **B**: Consultor
   - **C**: Tipo (Horário, JP, Massa)
   - **D**: Data Visita
   - **E**: Loja (DE)
   - **F**: Loja/Horário (PARA)
   - **G**: Motivo
   - **H**: Status (Ex: Pendente)

## Passo 2: Criar o Script
1. Na planilha, clique em **Extensões** > **Apps Script**.
2. Apague qualquer código que estiver no arquivo `Código.gs` e cole o código abaixo:

```javascript
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheets()[0];

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var nextRow = sheet.getLastRow() + 1;

    // Parse incoming JSON data
    var data = JSON.parse(e.postData.contents);
    
    // Create new row with explicit Timestamp (Date and Time)
    // Usamos o Utilities.formatDate para garantir que as horas e minutos apareçam
    var timestamp = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy HH:mm:ss");
    var newRow = [timestamp];
    
    // Map specific fields
    newRow.push(data.consultant || '');
    newRow.push(data.type || '');
    newRow.push(data.visitDate || '');
    newRow.push(data.storeFrom || '');
    newRow.push(data.storeTo || '');
    newRow.push(data.reason || '');
    newRow.push('Pendente');

    sheet.getRange(nextRow, 1, 1, newRow.length).setValues([newRow]);

    return ContentService
      .createTextOutput(JSON.stringify({ "result": "success", "row": nextRow }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ "result": "error", "error": e }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  finally {
    lock.releaseLock();
  }
}
```

3. Clique no ícone de **Disquete** (Salvar).

## Passo 3: Publicar e obter URL
1. Clique no botão azul **Implantar** (Deploy) > **Nova implantação**.
2. Clique na engrenagem ao lado de "Selecione o tipo" e escolha **App da Web**.
3. Configure assim:
   - **Descrição**: Log App JP
   - **Executar como**: *Eu* (seu email)
   - **Quem pode acessar**: *Qualquer pessoa* (Isso é importante para o App funcionar sem login extra)
4. Clique em **Implantar**.
5. Autorize o acesso com sua conta Google (pode aparecer um aviso de "App não verificado", clique em *Avançado* > *Acessar (não seguro)*).
6. Copie a **URL do App da Web** gerada (algo que começa com `https://script.google.com/macros/s/...`).

## Passo 4: Conectar no App
1. Crie um arquivo chamado `.env` na pasta raiz do projeto.
2. Adicione a seguinte linha, colando sua URL:
   ```
   VITE_GOOGLE_SHEETS_URL=https://script.google.com/macros/s/SEU_CODIGO_AQUI/exec
   ```
3. Reinicie o projeto (`npm run dev`) para pegar a nova configuração.
