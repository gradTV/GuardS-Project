const fs = require('fs');
const https = require('https');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { PassThrough } = require('stream');

process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 0;

const { Client, Intents, Collection, DiscordAPIError, EmbedBuilder, Message, GatewayIntentBits, CommandInteractionOptionResolver} = require('discord.js');
const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.DirectMessageReactions,
  GatewayIntentBits.DirectMessageTyping] 
 });

 client.setMaxListeners(20); // количество слушателей

config = require('./config.json');

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { exec } = require('child_process');

const { roleChanger } = require('./discord/roleChanger');
roleChanger.init(client);

// const { emoji } = require('./discord/emoji');

const discordToken = config.tokenDS;
const telegramToken = config.tokenTG;


const rest = new REST({ version: '10' }).setToken(discordToken);

// Определение новых команд
// const commands = [
//   new SlashCommandBuilder()
//     .setName('link')
//     .setDescription('Link a Discord channel to a Telegram chat')
//     .addChannelOption(option =>
//       option.setName('discord')
//         .setDescription('Choose a Discord channel')
//         .setRequired(true)
//         .addChannelTypes(0)  // Только текстовые каналы
//     )
//     .addStringOption(option =>
//       option.setName('telegram')
//         .setDescription('Telegram chat ID')
//         .setRequired(true)
//     ),

//     new SlashCommandBuilder()
//     .setName('sendmess')
//     .setDescription('Send a message to a specified user')
//     .addStringOption(option =>
//       option.setName('user_id')
//         .setDescription('User ID to send the message to')
//         .setRequired(true)
//     )
//     .addStringOption(option =>
//       option.setName('message')
//         .setDescription('Message to send')
//         .setRequired(true)
//     ),
  
//   new SlashCommandBuilder()
//     .setName('re')
//     .setDescription('Reply to a message')
//     .addStringOption(option =>
//       option.setName('message')
//         .setDescription('Reply text')
//         .setRequired(true)
//     )  

// ];
// // Когда бот готов, выполняем регистрацию команд
// client.once('ready', async () => {
//   try {
//     console.log('Started refreshing application (/) commands.');

//     // Очистка существующих команд для всего бота
//     await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
//     console.log('Successfully cleared existing application (/) commands.');

//     // Регистрация новых команд для всего бота
//     await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(command => command.toJSON()) });
//     console.log('Successfully reloaded application (/) commands.');
//   } catch (error) {
//     console.error('Error during commands refresh:', error);
//   }
//   });


const telegramBot = new TelegramBot(telegramToken, { polling: true });

//Discord link to Telegram
const channelMappings = {};

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'link') {
    const discordChannel = interaction.options.getChannel('discord');
    const telegramChatId = interaction.options.getString('telegram');

    if (!discordChannel || !telegramChatId) {
      return interaction.reply('Error: необходимо указать канал Discord и ID чата Telegram.');
    }

    // Удаляем предыдущее соединение, если оно есть
    for (const channelId in channelMappings) {
      if (channelMappings[channelId] === telegramChatId) {
        delete channelMappings[channelId];
        break;
      }
    }

    channelMappings[discordChannel.id] = telegramChatId;

    const embed = new EmbedBuilder()
      .setTitle('Связь установлена')
      .setDescription(`Канал ${discordChannel.name} связан с чатом Telegram ${telegramChatId}`)
      .setColor('#00FF00');

    await interaction.reply({ embeds: [embed] });
  }
});

const telegramToDiscordMap = new Map();
const discordToTelegramMap = new Map();

// Discord-to-Telegram message relay with support for replies and media.
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const channelId = message.channel.id;
  const telegramChatId = channelMappings[channelId];

  if (telegramChatId) {
    let messageContent = `[${message.member.displayName}]\n ${message.content}`;
    let sentTelegramMessage;
    const telegramOptions = {};

    // Check if the message is a reply
    if (message.reference && message.member?.messageId) {
      // Пытаемся найти оригинальное сообщение в Telegram
      const originalTelegramMessageId = discordToTelegramMap.get(message.reference.messageId);
      if (originalTelegramMessageId) {
        // Устанавливаем ID для ответа в Telegram
        telegramOptions.reply_to_message_id = originalTelegramMessageId;
      } else {
        // Если не нашли - добавляем цитату в текст
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        const repliedMessageAuthor = repliedMessage.member?.nickname || repliedMessage.author.username;
        messageContent = `> [${repliedMessageAuthor}] ${repliedMessage.content}\n\n${messageContent}`;
      }
    }

    // Обработка вложений (фото, видео и т.д.)
    if (message.attachments.size > 0) {
      const attachments = Array.from(message.attachments.values());
      
      // Для первого вложения добавляем основной текст как подпись
      for (const attachment of attachments) {
        const caption = attachments.length === 1 ? messageContent : null;
        if (caption) telegramOptions.caption = caption;
        
        // Сохраняем связь ID только для первого вложения
        if (attachment === attachments[0] && sentTelegramMessage) {
          discordToTelegramMap.set(message.id, sentTelegramMessage.message_id);
          telegramToDiscordMap.set(sentTelegramMessage.message_id, message.id);
        }
      }

      // Если несколько файлов - отправляем текст отдельным сообщением
      const standaloneText = messageContent.replace(`[${message.member?.nickname || message.author.username}] `, '').trim();
      if (attachments.length > 1 && standaloneText) {
        await telegramBot.sendMessage(telegramChatId, `${message.member?.nickname || message.author.username} ${standaloneText}`);
      }
    } else if (message.content) {
      // Отправка обычного текстового сообщения
      sentTelegramMessage = await telegramBot.sendMessage(telegramChatId, messageContent, telegramOptions);
      // Сохраняем связь ID сообщений
      discordToTelegramMap.set(message.id, sentTelegramMessage.message_id);
      telegramToDiscordMap.set(sentTelegramMessage.message_id, message.id);
    }

    // Send message Discord-to-Telegram
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
                  telegramBot.sendAnimation(telegramChatId, mediaBuffer, { caption: messageContent, ...telegramOptions});
                }
              });
            });
          }
          // Send file as URL
          const filePath = new URL(fileLink).pathname;
          if (/\.(jpg|jpeg|png)$/i.test(filePath)) {
            https.get(fileLink, async (response) => {
              const chunks = [];
              response.on('data', (chunk) => {
                chunks.push(chunk);
              });
              response.on('end', async () => {
                mediaBuffer = Buffer.concat(chunks);
                telegramBot.sendPhoto(telegramChatId, mediaBuffer, { caption: messageContent, ...telegramOptions});
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
                telegramBot.sendVideo(telegramChatId, mediaBuffer, { caption: messageContent, ...telegramOptions });
              });
            });
          } else {
            // Send Document
            telegramBot.sendDocument(telegramChatId, fileLink, { caption: messageContent, ...telegramOptions });
          }
        });
      }
    }
  }
});

const ffmpeg = require('fluent-ffmpeg');
const tmp = require('tmp');

// Telegram to Discord message relay with support for replies and media.
telegramBot.on('message', async (msg) => {
  
  const discordChannelId = Object.keys(channelMappings).find(
    (channelId) => channelMappings[channelId] === msg.chat.id.toString()
  );

  if (!discordChannelId) return;

  const discordChannel = client.channels.cache.get(discordChannelId);
  if (!discordChannel) return;

  const messageText = `**${msg.from.first_name}**`;
  // Формируем текст с именем отправителя
  let fullMessageContent = msg.text ? `${messageText}: ${msg.text}` : messageText;

  const discordOptions = {};

  // Обработка ответов в Telegram
  if (msg.reply_to_message && msg.reply_to_message.message_id) {
    // Пытаемся найти оригинальное сообщение в Discord
    const originalDiscordMessageId = telegramToDiscordMap.get(msg.reply_to_message.message_id);
    if (originalDiscordMessageId) {
      // Устанавливаем ответ в Discord
      const originalDiscordMessage = await discordChannel.messages.fetch(originalDiscordMessageId);
      discordOptions.reply = { messageReference: originalDiscordMessage };
    } else {
      // Добавляем цитату в текст, если не нашли оригинал
      const repliedContent = msg.reply_to_message.text || msg.reply_to_message.caption || '';
      const shortText = repliedContent.substring(0, 47) + (repliedContent.length > 50 ? '...' : '');
      fullMessageContent = `> ${msg.reply_to_message.from.first_name}: ${shortText}\n\n${fullMessageContent}`;
    }

    const sentDiscordMessage = await discordChannel.send({
      content: fullMessageContent,
      ...discordOptions
    });

    telegramToDiscordMap.set(msg.message_id, sentDiscordMessage.id);
    discordToTelegramMap.set(sentDiscordMessage.id, msg.message_id);
  }

  if (msg.photo || msg.video || msg.audio || msg.animation || msg.voice || msg.sticker ) {
    let fileLink = '';

    if (msg.photo) {
      fileLink = await telegramBot.getFileLink(msg.photo[msg.photo.length - 1].file_id); // photo
    } else if (msg.video) {
      fileLink = await telegramBot.getFileLink(msg.video.file_id); // video
    } else if (msg.audio) {
      fileLink = await telegramBot.getFileLink(msg.audio.file_id); // audio
    } else if (msg.animation) {
      fileLink = await telegramBot.getFileLink(msg.animation.file_id); // gif
    } else if (msg.voice) {
      fileLink = await telegramBot.getFileLink(msg.voice.file_id); // voice

      https.get(fileLink, (response) => {
        const inputStream = new PassThrough();
        response.pipe(inputStream);

        const outputStream = new PassThrough();

        ffmpeg(inputStream)
          .toFormat('mp3')
          .on('error', (err) => {
            console.error('Error: Convertation', err);
          })
          .pipe(outputStream);

        const fileName = `voice_${msg.voice.file_id}.mp3`;

        discordChannel.send({ content: messageText, files: [{ attachment: outputStream, name: fileName}] });
      });
      return;
    } else if (msg.sticker) { // sticker
      const fileLink = await telegramBot.getFileLink(msg.sticker.file_id);
    
      https.get(fileLink, async response => {
        const input = new PassThrough();
        response.pipe(input);

        const chunks = [];
        
        // WEBM covert to APNG
        ffmpeg(input)
          .outputFormat('apng')
          .on('end', async () => {
            const apngBuffer = Buffer.concat(chunks);
            const guild = discordChannel.guild;

            if (apngBuffer.length <= 512 * 1024) {
              // APNG send to Discord
              const sticker = await guild.stickers.create({
                name: `sticker_${msg.sticker.file_unique_id.slice(0, 24)}`,
                description: 'Sticker Telegram',
                tags: '💬',
                file: { content: messageText, attachment: apngBuffer, name: 'sticker.apng' }
              });
              await discordChannel.send({ content: messageText, stickers: [sticker.id] });
              setTimeout(() => sticker.delete(), 5000);
            } else {
              // If the APNG is too big, convert it to GIF.
              const gifChunks = [];
              const bufStream = new PassThrough();
              bufStream.end(apngBuffer);

              await new Promise((resolve, reject) => {
                ffmpeg(bufStream)
                  .outputFormat('gif')
                  .outputOptions([
                    '-vf', 'scale=160:160:flags=lanczos',
                    '-f', 'gif'
                  ])
                  .on('end', resolve)
                  .pipe()
                  .on('data', c => gifChunks.push(c));
              });

              const gifBuffer = Buffer.concat(gifChunks);
              await discordChannel.send({ files: [{ content: messageText, attachment: gifBuffer, name: 'sticker.gif' }] });
            }
          })
          .pipe()
          .on('data', chunk => chunks.push(chunk));
      });
      return;
    }

    discordChannel.send({
      content: messageText,
      files: [fileLink] });
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
        messageContent = `**${msg.from.first_name || 'Anonim'} ${msg.from.last_name || ''}:**\n`;
      } else {
        // Если у пользователя нет username, используем его имя и фамилию
        messageContent = `**${msg.from.first_name || 'Anonim'} ${msg.from.last_name || ''}:**\n`;
      }

      // Добавляем основное сообщение
      messageContent += `> ${msg.text}\n`;

      // Если сообщение было переслано, добавляем информацию о пересылке и оригинальное сообщение
      if (msg.forward_from || (msg.reply_to_message && msg.reply_to_message.from)) {
        let forwardedFrom = '';

        // Проверяем, определен ли объект msg.forward_from и его свойство username
        if (msg.forward_from && msg.forward_from.username) {
          forwardedFrom = `${msg.forward_from.first_name || 'Anonim'} ${msg.forward_from.last_name || ''}`;
        } else if (msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.username) {
          forwardedFrom = `${msg.reply_to_message.from.first_name || 'Anonim'} ${msg.reply_to_message.from.last_name || ''}`;
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

const storageUser = {}; // Storage for temporary user data
const saveID = {}; // Storage for saved IDs
const menuMessages = {}; // Storage for menu message IDs

telegramBot.onText(/\/link/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Initialize the NULL state for Discord and Telegram
  if (!storageUser[chatId]) {
    storageUser[chatId] = {
      telegramChatId: null,
      discordChannelId: null
    };
  }
  
  // Check ID
  const infoTelegram = saveID[chatId]?.telegramChatId;
  const infoDiscord = saveID[chatId]?.discordChannelId;

  // If menu already exists, edit it
  if (menuMessages[chatId]) {
    try {
      await showMainMenu(chatId, infoTelegram, infoDiscord);
      return;
    } catch (e) {
      // If message doesn't exist anymore, send new one
      delete menuMessages[chatId];
    }
  }
  
  // Send new menu
  await showMainMenu(chatId, infoTelegram, infoDiscord);
});

async function showMainMenu(chatId, hasTelegram = false, hasDiscord = false) {
  const buttons = [];
  
  // Button to Telegram
  buttons.push([{
    text: hasTelegram ? `Telegram ID: ${saveID[chatId].telegramChatId}` : 'Telegram ID:',
    callback_data: 'input_telegram'
  }]);
  
  // Button to Discord
  buttons.push([{
    text: hasDiscord ? `Discord ID: ${saveID[chatId].discordChannelId}` : 'Discord ID:',
    callback_data: 'input_discord'
  }]);
  
  // Confirmation button
  if (hasTelegram && hasDiscord) {
    buttons.push([{
      text: '✅ Confirm the connection',
      callback_data: 'confirm_link'
    }]);
  }

  const opts = {
    reply_markup: {
      inline_keyboard: buttons
    }
  };

  // Edit existing message or send new one
  if (menuMessages[chatId]) {
    await telegramBot.editMessageText('Select an action:', {
      chat_id: chatId,
      message_id: menuMessages[chatId],
      reply_markup: opts.reply_markup
    });
  } else {
    const sentMessage = await telegramBot.sendMessage(chatId, 'Select an action:', opts);
    menuMessages[chatId] = sentMessage.message_id;
  }
}

telegramBot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  
  // Store message ID if not already stored
  if (!menuMessages[chatId]) {
    menuMessages[chatId] = messageId;
  }
  
  if (data === 'input_telegram') {
    if (saveID[chatId]?.telegramChatId) {
      // Show edit menu
      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Change TG ID', callback_data: 'change_telegram' },
              { text: 'Back', callback_data: 'back_to_main' }
            ]
          ]
        }
      };
      await telegramBot.editMessageReplyMarkup(opts.reply_markup, {
        chat_id: chatId,
        message_id: messageId
      });
    } else {
      await telegramBot.editMessageText('Enter the Telegram chat ID:', {
        chat_id: chatId,
        message_id: messageId
      });
      storageUser[chatId].awaiting = 'telegram';
    }
  }
  else if (data === 'input_discord') {
    if (saveID[chatId]?.discordChannelId) {
      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Change Discord ID', callback_data: 'change_discord' },
              { text: 'Back', callback_data: 'back_to_main' }
            ]
          ]
        }
      };
      await telegramBot.editMessageReplyMarkup(opts.reply_markup, {
        chat_id: chatId,
        message_id: messageId
      });
    } else {
      await telegramBot.editMessageText('Enter Discord channel ID:', {
        chat_id: chatId,
        message_id: messageId
      });
      storageUser[chatId].awaiting = 'discord';
    }
  }
  else if (data === 'change_telegram') {
    await telegramBot.editMessageText('Enter new Telegram chat ID:', {
      chat_id: chatId,
      message_id: messageId
    });
    storageUser[chatId].awaiting = 'telegram';
  }
  else if (data === 'change_discord') {
    await telegramBot.editMessageText('Enter new Discord channel ID:', {
      chat_id: chatId,
      message_id: messageId
    });
    storageUser[chatId].awaiting = 'discord';
  }
  else if (data === 'back_to_main') {
    await showMainMenu(chatId, saveID[chatId]?.telegramChatId, saveID[chatId]?.discordChannelId);
  }
  else if (data === 'confirm_link') {
    channelMappings[saveID[chatId].discordChannelId] = saveID[chatId].telegramChatId;
    
    // Send confirmation (new message)
    await telegramBot.sendPhoto(
      chatId,
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7R-faUiuXq9zE8SYcP8OViy0qYevCwmbuly3MKZuvj9fXe3SeCDF6cvcwuEN__sunyRE&usqp=CAU',
      {
        caption: `Connection established!\nTelegram: ${saveID[chatId].telegramChatId}\nDiscord: ${saveID[chatId].discordChannelId}`
      }
    );
    delete storageUser[chatId];
    delete menuMessages[chatId];
  }
  
  await telegramBot.answerCallbackQuery(callbackQuery.id);
});

// ID input handler
telegramBot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id; // get ID user
  const text = msg.text;
  
  if (!storageUser[chatId]?.awaiting) return;
  
  if (storageUser[chatId].awaiting === 'telegram') {
    try {
      const telegramChatInfo = await telegramBot.getChat(text);
      if (!['channel', 'group', 'supergroup'].includes(telegramChatInfo.type)) {
        throw new Error('Invalid chat type');
      }
      
      // Save Telegram ID on button
      if (!saveID[chatId]) saveID[chatId] = {};
      saveID[chatId].telegramChatId = text;
      
      // Delete Telegram ID on button
      try {
        await telegramBot.deleteMessage(chatId, messageId);
      } catch (e) {
        console.log('Could not delete message:', e.message);
      }
      
      await showMainMenu(chatId, true, saveID[chatId]?.discordChannelId);
    } catch (error) {
      await telegramBot.sendMessage(chatId, '❌ Error: Specified Telegram chat not found or not a channel/group.');
      await showMainMenu(chatId, saveID[chatId]?.telegramChatId, saveID[chatId]?.discordChannelId);
    }
  }
  else if (storageUser[chatId].awaiting === 'discord') {
    const discordChannelId = text.match(/\d+/)?.[0];
    if (!discordChannelId) {
      await telegramBot.sendMessage(chatId, '❌ Invalid ID format. Enter numbers only.');
      await showMainMenu(chatId, saveID[chatId]?.telegramChatId, saveID[chatId]?.discordChannelId);
      return;
    }
    
    const discordChannel = client.channels.cache.get(discordChannelId);
    if (!discordChannel) {
      await telegramBot.sendMessage(chatId, '❌ Discord channel not found.');
      await showMainMenu(chatId, saveID[chatId]?.telegramChatId, saveID[chatId]?.discordChannelId);
      return;
    }

    // Save Discord ID
    if (!saveID[chatId]) saveID[chatId] = {};
    saveID[chatId].discordChannelId = discordChannelId;
    
    // Auto-delete after relay
    try {
      await telegramBot.deleteMessage(chatId, messageId);
    } catch (e) {
      console.log('Could not delete message:', e.message);
    }
    
    await showMainMenu(chatId, saveID[chatId]?.telegramChatId, true);
  }

  delete storageUser[chatId].awaiting;
});


// Заdумка, крч когdа ты в голосовом мог записать голосовое увеdомление в течении 10 секунd

telegramBot.onText(/\/id/, (msg) => {
  const chatId = msg.chat.id;
  telegramBot.sendMessage(chatId, `${chatId}`);
});


// Хранилище для сообщений (лучше использовать базу данных в реальном проекте)
const messageStore = new Map();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // Обработка команды /sendmess
  if (interaction.commandName === 'sendmess') {
    const userId = interaction.options.getString('user_id');
    const messageText = interaction.options.getString('message');

    try {
    const user = await client.users.fetch(userId);
    await user.send(`📩 Анонимное сообщение:> ${messageText}\nОтветить: /re [сообщение]`);

    await interaction.user.send({
        content: `**You said**:\n> ${messageText}`,
      });

      // Сохраняем связь: получатель → отправитель
      if (!global.messageLinks) global.messageLinks = new Map();
      global.messageLinks.set(userId, interaction.user.id); // userId получателя → ID отправителя

      await interaction.reply({
        content: `✅ Сообщение отправлено пользователю <@${userId}>`,
        flags: 64
      });
    } catch (error) {
        console.error('Error при отправке сообщения:', error);
        await interaction.reply({
          content: '❌ Не удалось отправить сообщение. Проверь правильность ID.',
          flags: 64
        });
    }
  }
  
  // Обработка команды /re
  if (interaction.commandName === 're') {
    const replyText = interaction.options.getString('message');

    try {
      // Получаем ID оригинального отправителя
      const senderID = global.messageLinks?.get(interaction.user.id);

      if (!senderID) {
        return interaction.reply({
          content: "❌ Нет сообщений для ответа. Сначала отправьте кому-то сообщение через /sendmess",
          flags: 64
        });
      }

      await interaction.user.send({
        content: `**You said**:\n> ${replyText}`
      });

      // Отправляем ответ
      const originalSender = await client.users.fetch(senderID);
      await originalSender.send(`📨 **Ответ на ваше сообщение:**\n > ${replyText}\nОтветить: /re [сообщение]`);

      // Обновляем связь для цепочки ответов
      global.messageLinks.set(senderID, interaction.user.id);

      await interaction.reply({
        content: "✅ Send!",
        flags: 64
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ Error: ${error.message}`,
        flags: 64
      });
    }
  }
});


client.on('messageCreate', message => {
  if (message.content === "avatar") {
    const embed = new RichEmbed()
    .setTitle('Avatar!')
    .setAuthor("Your Avatar", message.author.avatarURL)
    .setImage(message.author.avatarURL)
    .setColor('RANDOM')
    .setDescription('Avatar URL')
   message.reply(embed)
  }
});

client.login(config.tokenDS);