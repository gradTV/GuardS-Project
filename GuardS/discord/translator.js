const translate = require('translate-google');
const TelegramBot = require('node-telegram-bot-api');

// Теперь переменные будут доступны только внутри этого модуля
let targetLanguage = 'en';
let telegramBot; 

async function handleLangCommand(interaction) {
    const newLang = interaction.options.getString('language');
    if (newLang) {
      targetLanguage = newLang;
      await interaction.reply(`Мова перекладу успішно змінена на ${newLang}`);
    } else {
      await interaction.reply('Помилка: необхідно вказати цільову мову перекладу.');
    }
  
    await translateText(interaction.message); // Передаем объект сообщения, а не команды
}

async function translateText(message, telegramChatId) {
    if (message && message.content) { 
      const text = message.content;
      const russianWords = text.match(/[а-яА-ЯЁё]+/g);
      if (russianWords) {
        try {
          const translations = await Promise.all(russianWords.map(word => translate(word, { to: targetLanguage })));
          let messageContent = text;
          russianWords.forEach((word, index) => {
            const translatedWord = `${targetLanguage.toUpperCase()}: ${translations[index]} - ${word}`;
            messageContent = messageContent.replace(new RegExp(word, 'g'), translatedWord);
          });
          if (telegramBot && telegramChatId) {
            await telegramBot.sendMessage(telegramChatId, messageContent);
            console.log('Translated message sent to Telegram:', messageContent);
          } else {
            console.error('TelegramBot or telegramChatId is not initialized');
          }
        } catch (error) {
          console.error('Error while translating:', error);
        }
      }
    } else {
      console.error('Invalid message or no content to translate');
    }
}


// Экспортируем функции и переменные, которые хотим использовать в других файлах
module.exports = { handleLangCommand, translateText, targetLanguage };
