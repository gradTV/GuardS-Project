// const { Configuration, OpenAIApi } = require("openai");
const fs = require('fs');
const https = require('https');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { createCanvas, loadImage } = require('canvas');


process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 0;

const { Client, Intents, Collection, DiscordAPIError, MessageEmbed, Message, GatewayIntentBits, CommandInteractionOptionResolver} = require('discord.js');
const client = new Client({ intents: [
  Intents.FLAGS.GUILDS,
  Intents.FLAGS.GUILD_MEMBERS,
  Intents.FLAGS.GUILD_MESSAGES,
  Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  Intents.FLAGS.DIRECT_MESSAGES,
  Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
  Intents.FLAGS.DIRECT_MESSAGE_TYPING,
  Intents.FLAGS.DIRECT_MESSAGES] 
 });

 client.setMaxListeners(20); // количество слушателей

config = require('./config.json');


const Discord = require('discord.js');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const translate = require('translate-google');


const discordToken = config.token;
const telegramToken = config.tokenTG;


const rest = new REST({ version: '9' }).setToken(discordToken);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        // Очистка существующих команд
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [] }
        );

        // Регистрация новых команд
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
  })

const { getClanInfo } = require('./brawl/brawl');  // Перевод часть кода в другой файл(бравл старс)


const telegramBot = new TelegramBot(telegramToken, { polling: true });

//ДИСКОРД СОЕДИНЕНИЕ
const channelMappings = {};
let targetLanguage; // Теперь язык по умолчанию не устанавливается заранее

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'link') {
    const discordChannel = interaction.options.getChannel('discord_channel');
    const telegramChatId = interaction.options.getString('telegram_chat_id');

    if (!discordChannel || !telegramChatId) {
      return interaction.reply('Ошибка: необходимо указать канал Discord и ID чата Telegram.');
    }

    // Удаляем предыдущее соединение, если оно есть
    for (const channelId in channelMappings) {
      if (channelMappings[channelId] === telegramChatId) {
        delete channelMappings[channelId];
        break;
      }
    }

    channelMappings[discordChannel.id] = telegramChatId;

    const embed = new MessageEmbed()
      .setTitle('Связь установлена')
      .setDescription(`Канал ${discordChannel.name} связан с чатом Telegram ${telegramChatId}`)
      .setColor('#00FF00');

    await interaction.reply({ embeds: [embed] });
  } else if (commandName === 'lang') {
    const newLang = interaction.options.getString('language');
    if (newLang) {
      targetLanguage = newLang;
      await interaction.reply(`Язык перевода успешно изменен на ${newLang}`);
    } else {
      await interaction.reply('Ошибка: необходимо указать целевой язык перевода.');
    }
  } else if (commandName === 'brawl') {
    try {
      const channel = interaction.channel;
      await getClanInfo(channel);
    } catch (error) {
      console.error('Произошла ошибка:', error.message);
      await interaction.reply('Произошла ошибка при получении информации о клане.');
    }
  }
});



const ffmpeg = require('fluent-ffmpeg');

const { exec } = require('child_process');





//Из Dискорд в телеграмм

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const channelId = message.channel.id;
  const telegramChatId = channelMappings[channelId];
  const chatId = telegramChatId || message.chat.id;

  if (telegramChatId) {
    let messageContent = `[${message.author.username}] ${message.content}`;

    // Check if the message is a reply
    if (message.reference) {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      const repliedMessageContent = `[${repliedMessage.author.username}] ${repliedMessage.content}`;
      messageContent = `\n> ${repliedMessageContent}: \n${messageContent}`;
    }

    // Проверяем, установлен ли целевой язык
    if (targetLanguage) {
      const text = message.content;
      const russianWords = text.match(/[а-яА-ЯЁё]+/g);
      if (russianWords) {
          try {
              const translations = await Promise.all(russianWords.map(word => translate(word, { to: targetLanguage })));
              russianWords.forEach((word, index) => {
                  // Формуємо рядок в форматі "EN: переклад - оригінал"
                  const translatedWord = `${targetLanguage.toUpperCase()}: ${translations[index]} - ${word}`;
                  // Замінюємо російські слова на переклад з вказанням мови та оригінальним словом
                  messageContent = messageContent.replace(new RegExp(word, 'g'), translatedWord);
              });
          } catch (error) {
              console.error('Помилка при перекладі:', error);
          }
      }
  }
    

    // Отправка уведомлений из дс в телеграмм
    if (messageContent) {
      if (message.attachments.size > 0) {
        message.attachments.forEach(async (attachment) => {
          const fileLink = attachment.url;
          let mediaBuffer;
          if (/\.(gif)$/i.test(fileLink)) {
            https.get(fileLink, async (response) => {
              const chunks = [];
              response.on('data', (chunk) => {
                chunks.push(chunk);
              });
              response.on('end', async () => {
                const mediaBuffer = Buffer.concat(chunks);
                const isGIF = fileLink.toLowerCase().endsWith('.gif');
                if (isGIF) {
                  telegramBot.sendAnimation(telegramChatId, mediaBuffer, { caption: messageContent });
                }
              });
            });
          }
          // Отправка файлов в URL
          const filePath = new URL(fileLink).pathname;
          if (/\.(jpg|jpeg|png)$/i.test(filePath)) {
            https.get(fileLink, async (response) => {
              const chunks = [];
              response.on('data', (chunk) => {
                chunks.push(chunk);
              });
              response.on('end', async () => {
                mediaBuffer = Buffer.concat(chunks);
                telegramBot.sendPhoto(telegramChatId, mediaBuffer, { caption: messageContent });
              });
            });
          } else if (/\.(mp4|mov)$/i.test(filePath)) {
            https.get(fileLink, async (response) => {
              const chunks = [];
              response.on('data', (chunk) => {
                chunks.push(chunk);
              });
              response.on('end', async () => {
                mediaBuffer = Buffer.concat(chunks);
                telegramBot.sendVideo(telegramChatId, mediaBuffer, { caption: messageContent });
              });
            });
          } else {
            // Отправка документов
            telegramBot.sendDocument(telegramChatId, fileLink, { caption: messageContent });
          }
        });
      } else {
        telegramBot.sendMessage(telegramChatId, messageContent);
      }
    }
  }
});






telegramBot.on('message', (msg) => {
  const discordChannelId = Object.keys(channelMappings).find(
    (channelId) => channelMappings[channelId] === msg.chat.id.toString()
  );

  if (discordChannelId && msg.text) {
    const discordChannel = client.channels.cache.get(discordChannelId);
    if (discordChannel) {
      let messageContent = '';
  
      // Проверяем, определен ли объект msg.from и его свойство username
      if (msg.from && msg.from.username) {
        messageContent = `**${msg.from.first_name || 'Аноним'} ${msg.from.last_name || ''}:**\n`;
      } else {
        // Если у пользователя нет username, используем его имя и фамилию
        messageContent = `**${msg.from.first_name || 'Аноним'} ${msg.from.last_name || ''}:**\n`;
      }

      // Добавляем основное сообщение
      messageContent += `> ${msg.text}\n`;

      // Если сообщение было переслано, добавляем информацию о пересылке и оригинальное сообщение
      if (msg.forward_from || (msg.reply_to_message && msg.reply_to_message.from)) {
        let forwardedFrom = '';

        // Проверяем, определен ли объект msg.forward_from и его свойство username
        if (msg.forward_from && msg.forward_from.username) {
          forwardedFrom = `${msg.forward_from.first_name || 'Аноним'} ${msg.forward_from.last_name || ''}`;
        } else if (msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.username) {
          forwardedFrom = `${msg.reply_to_message.from.first_name || 'Аноним'} ${msg.reply_to_message.from.last_name || ''}`;
        } else if (msg.forward_from && msg.forward_from.first_name) {
          // Если у пользователя нет username, используем его имя и фамилию
          forwardedFrom = `${msg.forward_from.first_name} ${msg.forward_from.last_name || ''}`;
        } else if (msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.first_name) {
          // Если у пользователя нет username, используем его имя и фамилию
          forwardedFrom = `${msg.reply_to_message.from.first_name} ${msg.reply_to_message.from.last_name || ''}`;
        }

        // Если есть информация о том, от кого переслано
        if (forwardedFrom) {
          messageContent += `> ${forwardedFrom}: ${msg.reply_to_message.text}`;
        }
      }

      discordChannel.send(messageContent);
    }
  }
})











telegramBot.onText(/\/link/, async (msg) => {
  const chatId = msg.chat.id;

  // Отправка запроса на ID чата Telegram
  telegramBot.sendMessage(chatId, 'Введите ID чата Telegram:');
  telegramBot.once('message', async (responseMsg) => {
    const telegramChatId = responseMsg.text;

    // Проверка существования указанного Telegram-канала
    try {
      const telegramChatInfo = await telegramBot.getChat(telegramChatId);
      if (!telegramChatInfo || (telegramChatInfo.type !== 'channel' && telegramChatInfo.type !== 'group' && telegramChatInfo.type !== 'supergroup')) {
        telegramBot.sendMessage(chatId, 'Указанный чат Telegram не найден или не является каналом или группой.');
        return;
      }
    } catch (error) {
      telegramBot.sendMessage(chatId, 'Указанный чат Telegram не найден.');
      return;
    }

    // Отправка запроса на упоминание канала Discord
    telegramBot.sendMessage(chatId, 'Укажите ID канала Discord:');
    telegramBot.once('message', async (responseMsg) => {
      const discordChannelMention = responseMsg.text;

      // Извлечение ID из упоминания канала Discord
      const matches = discordChannelMention.match(/\d+/);
      if (!matches) {
        telegramBot.sendMessage(chatId, 'Указанный канал Discord не найден.');
        return;
      }

      const discordChannelId = matches[0];

      const discordChannel = client.channels.cache.get(discordChannelId);
      if (!discordChannel) {
        telegramBot.sendMessage(chatId, 'Указанный канал Discord не найден.');
        return;
      }

      // Установка связи между каналами
      channelMappings[discordChannel.id] = telegramChatId;

      const embed = new MessageEmbed()
        .setTitle('Связь установлена')
        .setDescription(`Канал Discord ${discordChannel} связан с каналом Telegram ${telegramChatId}`)
        .setColor('#00FF00');

      // Отправка уведомления в Telegram
      telegramBot.sendPhoto(chatId, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQjSAxcY45oqP3C_w_2J7GFY6q1RrFDdwuOwcIwH4IIaRaO1oeSj9bMJzg6MHLxi9rzrfc&usqp=CAU', {
        caption: 'Связь успешно установлена.'
      });
      
      // Отправка сообщения в Discord о связи
      discordChannel.send({ embeds: [embed] });
    });
  });
});



// Из Telegram в Discord
telegramBot.on('message', async (msg) => {
  if (msg.photo || msg.video || msg.audio || msg.animation) {
    const messageText = `**${msg.from.first_name}**`;
    const discordChannelId = Object.keys(channelMappings).find(
      (channelId) => channelMappings[channelId] === msg.chat.id.toString()
    );

    if (discordChannelId) {
      const discordChannel = client.channels.cache.get(discordChannelId);
      if (discordChannel) {
        let fileLink = '';

        if (msg.photo) {
          fileLink = await telegramBot.getFileLink(msg.photo[msg.photo.length - 1].file_id);
        } else if (msg.video) {
          fileLink = await telegramBot.getFileLink(msg.video.file_id);
        } else if (msg.audio) {
          fileLink = await telegramBot.getFileLink(msg.audio.file_id);
        } else if (msg.animation) {
          fileLink = await telegramBot.getFileLink(msg.animation.file_id);             //фото, гиф, видео и голосовые
        }

        discordChannel.send({
          content: messageText,
          files: [fileLink]
        });
      }
    }
  }
});

// Обработчик голосового уведомления
telegramBot.on('message', async (msg) => {
  if (msg.voice) {
    const messageText = `**${msg.from.first_name}**`;
    const discordChannelId = Object.keys(channelMappings).find(
      (channelId) => channelMappings[channelId] === msg.chat.id.toString()
    );

    if (discordChannelId) {
      const discordChannel = client.channels.cache.get(discordChannelId);
      if (discordChannel) {
        let fileLink = '';

        if (msg.voice) {
          fileLink = await telegramBot.getFileLink(msg.voice.file_id);
        }

        // Создание потока файла для сохранения на диск
        const inputFilePath = `./${fileLink.split('/').pop()}`;
        const outputFilePath = inputFilePath.replace('.oga', '.mp3');
        const fileStream = fs.createWriteStream(inputFilePath);

        // Сохранение вложения на диск
        const response = await axios({
          url: fileLink,
          method: 'GET',
          responseType: 'stream'
        });
        response.data.pipe(fileStream);

        fileStream.on('finish', () => {
          // Конвертация файла из OGA в MP3
          ffmpeg(inputFilePath)
            .toFormat('mp3')
            .on('end', () => {
              console.log('Конвертация завершена.');
              // Отправка сконвертированного файла в Discord
              const convertedFileStream = fs.createReadStream(outputFilePath);
              // Отправляем файл
              discordChannel.send({
                content: messageText,
                files: [{
                  attachment: convertedFileStream,
                  name: outputFilePath.split('/').pop()
                }]
              }).then(() => {
                console.log('Файл успешно отправлен в Discord');
                // Удаление временных файлов
                fs.unlinkSync(inputFilePath);
                fs.unlinkSync(outputFilePath);
              }).catch(console.error);
            })
            .on('error', (err) => {
              console.error('Ошибка конвертации:', err);
            })
            .save(outputFilePath);
        });
      }
    }
  }
});


























// Обработчик сообщений Telegram
// telegramBot.on('message', async (msg) => {
//   const chatId = msg.chat.id;
//   const text = msg.text;

//   // Перевіряємо, чи існує текстовий зміст у повідомленні
//   if (!text) {
//     console.log('Повідомлення не містить тексту');
//     return;
//   }

//   // Перевіряємо, чи повідомлення починається зі слеш-команди "/lang"
//   if (text.startsWith('/lang')) {
//     // Отримуємо мовний параметр з команди
//     const langCommand = text.substring(6).trim().toLowerCase(); // Видаляємо "/lang" та зайві пробіли

//     // Перевіряємо валідність мови
//     if (langCommand === 'ru' || langCommand === 'en') {
//       // Встановлюємо цільову мову
//       targetLanguage = langCommand;
//       await telegramBot.sendMessage(chatId, `Мова встановлена на ${targetLanguage === 'ru' ? 'русский' : 'англійський'}.`);
//     } else {
//       await telegramBot.sendMessage(chatId, 'Допустимі значення мови: ru (русский), en (англійський).');
//     }
//     return; // Завершуємо виконання обробника
//   }

//   // Перевіряємо, чи існує цільова мова
//   if (!targetLanguage) {
//     return; // Завершуємо виконання обробника
//   }

//   // Перевіряємо, чи текст містить російські слова
//   const russianWords = text.match(/[а-яА-ЯЁё]+/g);
//   if (russianWords) {
//     try {
//       // Перекладаємо російські слова на вказану мову
//       const translations = await Promise.all(russianWords.map(word => translate(word, { to: targetLanguage })));

//       // Замінюємо російські слова у тексті на їх переклад
//       const translatedText = text.replace(/[а-яА-ЯЁё]+/g, (match, offset) => {
//         const index = russianWords.indexOf(match);
//         return `> ${targetLanguage.toUpperCase()}: ${translations[index]}`;
//       });

//       // Відправляємо перекладений текст у Discord
//       const discordChannelId = Object.keys(channelMappings).find(
//         (channelId) => channelMappings[channelId] === msg.chat.id.toString()
//       );
//       if (discordChannelId) {
//         const discordChannel = client.channels.cache.get(discordChannelId);
//         if (discordChannel) {
//           discordChannel.send(translatedText);
//         }
//       }
//     } catch (error) {
//       console.error('Помилка при перекладі:', error);
//     }
//   }
// });

telegramBot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Перевіряємо, чи існує текстовий зміст у повідомленні
  if (!text) {
    console.log('Повідомлення не містить тексту');
    return;
  }

  // Перевіряємо, чи повідомлення починається зі слеш-команди "/lang"
  if (text.startsWith('/lang')) {
    // Отримуємо мовний параметр з команди
    const langCommand = text.substring(6).trim().toLowerCase(); // Видаляємо "/lang" та зайві пробіли

    // Перевіряємо валідність мови
    if (langCommand === 'ru' || langCommand === 'en' || langCommand === 'ua' || langCommand === 'uk') {
      // Встановлюємо цільову мову
      targetLanguage = langCommand;
      await telegramBot.sendMessage(chatId, `Мова встановлена на ${targetLanguage === 'ru' ? 'російську' : targetLanguage === 'en' ? 'англійську' : 'українську'}.`);
    } else {
      await telegramBot.sendMessage(chatId, 'Допустимі значення мови: ru (російська), en (англійська), ua/uk (українська).');
    }
    return; // Завершуємо виконання обробника
  }

  // Перевіряємо, чи існує цільова мова
  if (!targetLanguage) {
    return; // Завершуємо виконання обробника
  }

  // Перевіряємо, чи текст містить російські або українські слова
  const russianWords = text.match(/[а-яА-ЯЁё]+/g);
  const ukrainianWords = text.match(/[а-яєіїґ]+/ig);
  const allWords = [...new Set([...(russianWords || []), ...(ukrainianWords || [])])]; // Об'єднуємо російські та українські слова

  if (allWords.length > 0) {
    try {
      // Перекладаємо слова на вказану мову
      const translations = await Promise.all(allWords.map(word => translate(word, { to: targetLanguage })));

      // Замінюємо слова у тексті на їх переклад
      let translatedText = text;
      allWords.forEach((word, index) => {
        // Формуємо рядок в форматі "EN: переклад - оригінал"
        const translatedWord = `> ${targetLanguage.toUpperCase()}: ${translations[index]} (${word})`; // Додаємо оригінальне слово у дужках
        // Замінюємо слова на їх переклад з вказанням мови та оригінального слова
        translatedText = translatedText.replace(new RegExp(word, 'g'), translatedWord);
      });

      // Відправляємо перекладений текст у Discord
      const discordChannelId = Object.keys(channelMappings).find(
        (channelId) => channelMappings[channelId] === msg.chat.id.toString()
      );
      if (discordChannelId) {
        const discordChannel = client.channels.cache.get(discordChannelId);
        if (discordChannel) {
          discordChannel.send(translatedText);
        }
      }
    } catch (error) {
      console.error('Помилка при перекладі:', error);
    }
  }
});


client.on('messagecreate', async message => {
  // Проверяем, содержит ли сообщение стикер

  if (message.stickers.size > 0) {
      let sticker = message.stickers.first();
      let response = await fetch(sticker.url);
      let buffer = await response.buffer();
      
      // Отправляем стикер в Telegram
      telegramBot.sendSticker(telegramToken, buffer).then(() => {
          console.log('Sticker sent to Telegram');
      }).catch(console.error);
  }
});


// const getDiscordChannelId = (telegramChatId) => {
//   return Object.keys(channelMappings).find(
//     (channelId) => channelMappings[channelId] === telegramChatId.toString()
//   );
// };

// // Обработчик событий Discord для отправки стикеров и эмодзи в Telegram
// client.on('messageCreate', async (message) => {
//   if (message.author.bot) return;
//   if (!message.attachments.size && !message.content.includes(':')) return;

//   const telegramChatId = channelMappings[message.channel.id];
//   if (!telegramChatId) return;

//   // Отправка анимированных стикеров
//   message.attachments.forEach((attachment) => {
//     // Проверяем, что вложение - это анимированный стикер
//     if (attachment.url.endsWith('.gif')) {
//       // Отправляем анимированный стикер в Telegram
//       telegramBot.sendAnimation(telegramChatId, attachment.url)
//         .catch((error) => {
//           console.error('Ошибка при отправке анимации в Telegram:', error.message);
//         });
//     }
//   });

//   // Отправка кастомных эмодзи
//   const customEmojiRegex = /<a?:\w+:(\d+)>/g;
//   let match;
//   while ((match = customEmojiRegex.exec(message.content)) !== null) {
//     const emojiId = match[1];
//     const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.gif?v=1`;
//     // Отправляем кастомное эмодзи в Telegram
//     telegramBot.sendSticker(telegramChatId, emojiUrl)
//       .catch((error) => {
//         console.error('Ошибка при отправке эмодзи в Telegram:', error.message);
//       });
//   }
// });

// // Обработчик событий Telegram для получения сообщений
// telegramBot.on('message', async (msg) => {
//   const discordChannelId = getDiscordChannelId(msg.chat.id);
//   if (!discordChannelId) return;

//   // Проверяем, содержит ли сообщение кастомные эмодзи
//   if (msg.text && msg.text.match(/<a?:\w+:\d+>/g)) {
//     // Получаем все кастомные эмодзи из сообщения
//     const customEmojis = msg.text.match(/<a?:\w+:\d+>/g);

//     // Отправляем каждое эмодзи в Discord
//     customEmojis.forEach(async (customEmoji) => {
//       try {
//         // Получаем ID эмодзи из текста
//         const emojiId = customEmoji.match(/\d+/)[0];
//         // Создаем ссылку на эмодзи
//         const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.jpeg`;
//         // Отправляем эмодзи в Discord канал
//         const fileStream = request(emojiUrl);
//         fileStream.on('error', function(err) {
//           console.error('Ошибка при чтении файла:', err);
//         });
//         // Отправляем файл в Discord канал
//         discordClient.channels.cache.get(discordChannelId).send({
//           files: [fileStream],
//         });
//       } catch (error) {
//         console.error('Ошибка при отправке эмодзи в Discord:', error.message);
//       }
//     });
//   }
// });

// // Обработка ошибок
// client.on('error', console.error);
// telegramBot.on('error', console.error);

// // Обработка ошибок
// client.on('error', console.error);
// telegramBot.on('error', console.error);











// Заdумка, крч когdа ты в голосовом мог записать голосовое увеdомление в течении 10 секунd

// client.on('messageCreate', async message => {
//   if (!message.guild) return;
//   if (message.content.startsWith('!sendvoice')) { // команда для отправки голосового сообщения
//     const voiceChannel = message.member?.voice.channel; // получаем голосовой канал пользователя

//     if (!voiceChannel) {
//       return message.reply('Вы должны быть в голосовом канале, чтобы отправить голосовое сообщение!');
//     }

//     try {
//       const connection = await voiceChannel.join();
//       const dispatcher = connection.play(fs.createReadStream('.opus')); // указываем путь к вашему голосовому сообщению в формате Opus

//       dispatcher.on('start', () => {
//         console.log('Голосовое сообщение начало воспроизведение');
//       });

//       dispatcher.on('finish', () => {
//         console.log('Голосовое сообщение закончило воспроизведение');
//         voiceChannel.leave(); // после окончания воспроизведения сообщения бот покидает голосовой канал
//       });

//       dispatcher.on('error', console.error);
//     } catch (error) {
//       console.error('Ошибка:', error);
//     }
//   }
// });










telegramBot.onText(/\/id/, (msg) => {
  const chatId = msg.chat.id;
  telegramBot.sendMessage(chatId, `${chatId}`);
});
















telegramBot.onText(/\/button/, (msg) => {
  const chatId = msg.chat.id;

  const inlineKeyboard = [
    [{ text: 'Нажми меня', callback_data: 'button_pressed' }]
  ];

  const opts = {
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    }
  };

  telegramBot.sendMessage(chatId, 'Узнать ID:', opts);
});

telegramBot.on('callback_query', (query) => {
  if (query.data === 'button_pressed') {
    const chatId = query.message.chat.id;
    telegramBot.sendMessage(chatId, 'Кнопка была нажата!');
  }
});









client.on('messageCreate', message => {
    if (message.content.startsWith('!kiss')) {
      if (!message.mentions.users.size) {
        return message.channel.send('Тебе нужно пингануть человека!');
      }

      const taggedUser = message.mentions.users.first();
      const embed = new MessageEmbed()
        .setColor('#F08080')
        .setTitle(`${message.author.username} поцеловал ${taggedUser.username}! 💖`)
        .setImage('https://i.pinimg.com/originals/99/c4/18/99c41869ba1551575aefd9c8ffc533de.gif')
      message.channel.send({ embeds: [embed] });
  
      console.warn(`Команда поцелуй запущена ${message.author.tag} в ${message.guild.name}#${message.channel.name}`);
    }








    if (message.content.startsWith('!add-role')) {
        const roleMention = message.content.split(' ')[1];
        const roleName = roleMention.replace(/<@&(\d+)>/, '$1'); // говорит о айди роли
        const role = message.guild.roles.cache.get(roleName);

        if (!role) {
          return message.reply(`Извините, нет роли с ID ${roleName}.`); //текст о том, что забыл написать
        }
        
        const member = message.mentions.members.first();
        if (!member) {
          return message.reply('Пожалуйста, укажите пользователя, которому нужно назначить роль.'); // текст о том, что забыл написать учасника
        }
        
        const nickname = `🔖 ${member.displayName}`;
        
        member.setNickname(nickname).then(() => {
          member.roles.add(role).then(() => {
            message.reply(`Добавлена роль ${roleMention} для :bookmark: ${member.toString()}.`);
          }).catch(err => {
            message.reply(`Не удалось добавить роль ${member.displayName}: ${err.message}`);
          });
        }).catch(err => {
          message.reply(`Не удалось установить псевдоним ${member.displayName}: ${err.message}`);
        })
    } else if (message.content.startsWith('!remove-role')) {
        {
            const roleMention = message.content.split(' ')[1];
            if (!roleMention) {
                return message.reply('Укажите роль, которую нужно удалить.🗑️');
            }
            const roleName = roleMention.replace(/<@&(\d+)>/, '$1'); // Extract role ID from mention
            const role = message.guild.roles.cache.get(roleName);
            if (!role) {
              return message.reply(`Извините, нет роли с ID ${roleName}.`);
            }
            
            const member = message.mentions.members.first();
            if (!member) {
              return message.reply('Пожалуйста, укажите пользователя, которому нужно назначить роль.');
            }
            
            member.setNickname(null).then(() => {
              member.roles.remove(role).then(() => {
                message.reply(`Удалена роль ${roleMention} у :bookmark:${member.toString()}.`);
              }).catch(err => {
                message.reply(`Не удалось убрать роль ${member.displayName}: ${err.message}`);
              });
            }).catch(err => {
              message.reply(`Не удалось восстановить никнейм ${member.displayName}: ${err.message}`);
            })
        }
    }
    if (message.content.startsWith('!emoji')) {
      const member = message.mentions.members.first();
      if (!member) {
        return message.reply('Пожалуйста, укажите пользователя, чтобы установить эмодзи-роль.');
      }
    
      const emoji = message.content.split(' ')[2];
      const nickname = `${emoji} ${member.displayName}`;
    
      member.setNickname(nickname).then(() => {
       // message.react(emoji);
        message.reply(`Добавлен эмодзи ${emoji} к никнейму ${member.displayName}.`);
      }).catch(err => {
        message.reply(`Не удалось добавить эмодзи-роль для ${member.displayName}: ${err.message}`);
      });
    
    } else if (message.content.startsWith('!remmoji')) {
      const member = message.mentions.members.first();
  if (!member) {
    return message.reply('Please mention a user to remove the emoji from.');
  }
  const nickname = member.displayName.replace(/🔖\s*/g, '');
  member.setNickname(nickname).then(() => {
    message.reply(`Removed 🔖 emogi from ${member.displayName}.`);
  }).catch(err => {
    message.reply(`Unable to remove emogi role from ${member.displayName}: ${err.message}`);
  });
    }
  })

  client.on('messageCreate', message => {
  if (message.content.startsWith('!add-emoji')) {
    const emojiName = message.content.split(' ')[1];
    const emojiURL = message.content.split(' ')[2];

    message.guild.emojis.create(emojiURL, emojiName)
      .then(emoji => message.channel.send(`Emoji ${emoji} has been added!`))
      .catch(error => message.channel.send(`Error: ${error}`));
  } else if (message.content.startsWith('!del-emoji')) {
      const emojiName = message.content.split(' ')[1];
      const emoji = message.guild.emojis.cache.find(emoji => emoji.name === emojiName);
      if (!emoji) {
        return message.reply(`Sorry, couldn't find emoji ${emojiName}.`);
      }
      emoji.delete()
        .then(() => message.reply(`Deleted emoji ${emojiName} successfully.`))
        .catch(err => message.reply(`Error deleting emoji ${emojiName}: ${err.message}`));
    }
    const roleIds = ['1011607236138782820', '1075386755856994317', '1078503876375892111','1078503888266731651','1078503890619732008','1078503892922404975']; // менять роли
    let intervalId;
    
    function changeRole() {
      const member = message.guild.members.cache.get(message.author.id);
      if (!member) {
        console.error('Member not found');
        return;
      }
      const randomRole = roleIds[Math.floor(Math.random() * roleIds.length)];
      const role = message.guild.roles.cache.get(randomRole);
      if (!role) {
        console.error('Role not found');
        return;
      }
      member.roles.set([role]).catch(console.error);
    }
    
    if (message.content === 'changerole') {
      if (intervalId) {
        message.channel.send('Команда уже запущена!');
        return;
      }
      intervalId = setInterval(changeRole, 2000); 
      message.channel.send('Роль будет меняться каждые 2 секунды!');
    } else if (message.content === '!stopchangerole') {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        message.channel.send('Смена ролей остановлена!');
      } else {
        message.channel.send('Смена ролей уже остановлена!');
      }
    }
  })

  const isBlocked = false;
  client.on('messageCreate', async message => {
    if (message.content.startsWith('!sendmess')) {
      // проверяем, есть ли у автора сообщения права админа


      // if (!message.member.roles.cache.some(role => role.hasPermission('ADMINISTRATOR'))) {
      //   return message.channel.send('У вас нет прав на использование этой команды');
      // }


  
      if (isBlocked) {
        return message.author.send('Отправка сообщений заблокирована');
      }
  
      const userId = message.mentions.users.first()?.id || message.content.split(' ')[1];
      const text = message.content.replace(/<@!?(\d+)>/, '').split(' ').slice(2).join(' ');
  
      if (!userId || !text) {
        return message.channel.send('Пожалуйста, укажите ID пользователя и текст сообщения');
      }
  
      const user = await client.users.fetch(userId);
      if (!user) {
        return message.channel.send(`Пользователь с ID ${userId} не найден`);
      }
  
      user.send(`<@${userId}>: ${text}`)
        .then(() => {
          message.channel.send(`Сообщение для <@${userId}> отправлено`);
        })
        .catch(error => {
          message.channel.send(`Не удалось отправить сообщение для <@${userId}>: ${error.message}`);
          console.error(error);
        });
  
    } else if (message.content.startsWith('!sendblock')) {

      // проверяем, есть ли у автора сообщения права админа
      //  if (!message.member.roles.cache.some(role => role.hasPermission('ADMINISTRATOR'))) {
      //   return message.channel.send('У вас нет прав на использование этой команды');
      // }
  
      if (message.mentions.users.size === 0) {
        return message.author.send('Пожалуйста, укажите пользователя, которого необходимо заблокировать');
      }
      isBlocked = true;
      message.author.send(`Отправка сообщений для ${message.mentions.users.map(user => `<@${user.id}>`).join(', ')} заблокирована`);
  
    } else if (message.content.startsWith('!sendunblock')) {
      // проверяем, есть ли у автора сообщения права админа

//  if (!message.member.roles.cache.some(role => role.hasPermission('ADMINISTRATOR'))) {
//         return message.channel.send('У вас нет прав на использование этой команды');
//       }
  
      if (message.mentions.users.size === 0) {
        return message.author.send('Пожалуйста, укажите пользователя, которого необходимо разблокиро')
      }
    }
  });










// client.on('messageCreate', message => {
//   if (message.content === "/avatar") {
//     const embed = new RichEmbed()
//     .setTitle('Avatar!')
//     .setAuthor("Your Avatar", message.author.avatarURL)
//     .setImage(message.author.avatarURL)
//     .setColor('RANDOM')
//     .setDescription('Avatar URL')
//    message.reply(embed)
//   }
// });





    // const roleIds = ['1011607236138782820', '1075386755856994317', '1078503876375892111','1078503888266731651','1078503890619732008','1078503892922404975']; // менять роли

    // function changeRole() {
    //   const member = message.guild.members.cache.get(message.author.id);
    //   if (!member) {
    //     console.error('Member not found');
    //     return;
    //   }
    //   const randomRole = roleIds[Math.floor(Math.random() * roleIds.length)];
    //   const role = message.guild.roles.cache.get(randomRole);
    //   if (!role) {
    //     console.error('Role not found');
    //     return;
    //   }
    //   member.roles.set([role]).catch(console.error);
    // }
    
    // if (message.content === 'rolechange') {
    //   setInterval(changeRole, 3000); // 5000 миллисекунд = 5 секунд
    //   message.channel.send('Роль будет меняться каждые 5 секунд!');
    // }


// client.on('ready', () =>{
//     console.log('Compass is online');
// })
// client.on('message', (message) => {
//     if (message.content == "1")! {
//         message.reply(`<@${message.guild.ownerId}>`);
//     }
//     }
// );
// client.on('messageCreate', message=>{

//     if (!message.content.startsWith(config.prefix) || message.author.bot) return;
//         const args = message.content.slice(config.prefix.length).split(/ +/g);
//         const command = args.shift().toLowerCase();

//         const cmd = client.commands.get(command) || client.aliases.get(command);

//     if (!cmd) return;

//     cmd.run(client, message, args);
// })
// client.on('interactionCreate', async interaction => {
// 	if (!interaction.isChatInputCommand()) return;

// 	const { commandName } = interaction;

// 	if (commandName === 'ping') {
// 		await interaction.reply('Pong!');
//     }
// });



// const { Configuration, OpenAIApi } = require("openai");
// const { Client, Intents } = require('discord.js');


// const fs = require('fs');
// const client = new Client({intents: [
//   Intents.FLAGS.GUILDS, 
//   Intents.FLAGS.GUILD_MESSAGES,
//   Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
//   Intents.FLAGS.DIRECT_MESSAGES,
//   Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
//   Intents.FLAGS.DIRECT_MESSAGE_TYPING,
//   Intents.FLAGS.DIRECT_MESSAGE_TYPING] });

//   config = require('./config.json');












// const conf = new Configuration({
//   apiKey: "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",
// });
// client.on('messageCreate', async message => {
//   if (message.author.bot) return; // Ignore messages from bots
//   if (!message.content.startsWith('!gpt')) return;
// const api = new OpenAIApi(conf)
// const model = "text-davinci-003";
// const prompt = message.content.slice("!gpt")
// try {
//   const completions = await api.createCompletion({
//     model,
//     prompt,
//     max_tokens: 2200,
//     n: 1,
//   });
//   const response = completions.data.choices[0].text.trim();
//   message.channel.send(response);
// } catch (err) {
//   console.error(err);
//   message.channel.send("I'm sorry, I couldn't answer that question.");
// }
// console.log(message.content.slice(10)) // или какое у тебя сейчас число там.
// });



client.login(config.token);




















































// const openai = require('openai');

// config = require('./config.json');

// const commandFiles = fs.readdirSync('./commands/act').filter(file => file.endsWith('.js'));

// for (const file of commandFiles) {
//    const command = require(`./commands/act/${file}`);
//    client.commands.set(command.name, command);
// }

// const prompt = "I need an answer to the following question: What is the meaning of life?";
// const engine = "text-davinci-002";
// const apiKey = process.env.OPENAI_API_KEY;
// openai.apiKey = "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";

// client.on('messageCreate', async message => {
//   if (message.content.startsWith('!question')) {
//     const question = message.content.slice(10);
//     const input = `${prompt}\nQ: ${question}\nA:`;
//     const completions = await openai.default.complete({
//       engine,
//       apiKey,
//       prompt: input,
//       maxTokens: 1024,
//       n: 1,
//       stop: "\n"
//     });
//     const response = completions.choices[0].text.trim();
//     message.channel.send(response);
//   }
// });
// client.on('messageCreate', message => {
//   if (!message.content.startsWith('!') || message.author.bot) return;

//   const args = message.content.slice(1).trim().split(/ +/);
//   const commandName = args.shift().toLowerCase();

//   const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

//   if (!command) return;

//   try {
//     command.execute(message, args);
//   } catch (error) {
//     console.error(error);
//     message.reply('There was an error trying to execute that command!');
//   }
//   client.on('interactionCreate', async interaction => {
//     if (!interaction.isCommand()) return;
  
//     const { commandName } = interaction;
  
//     if (!client.commands.has(commandName)) return;
  
//     try {
//       await client.commands.get(commandName).execute(interaction);
//     } catch (error) {
//       console.error(error);
//       await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
//     }
//   });
// });
