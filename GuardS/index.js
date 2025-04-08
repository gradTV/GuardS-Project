const fs = require('fs');
const https = require('https');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');


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


const discordToken = config.tokenDS;
const telegramToken = config.tokenTG;


const rest = new REST({ version: '10' }).setToken(discordToken);

// Определение новых команд
// const commands = [
//   new SlashCommandBuilder()
//     .setName('link')
//     .setDescription('Link a Discord channel to a Telegram chat')
//     .addChannelOption(option =>
//       option.setName('discord_channel')
//         .setDescription('Выберите канал Discord')
//         .setRequired(true)
//         .addChannelTypes(0)  // Только текстовые каналы
//     )
//     .addStringOption(option =>
//       option.setName('telegram_chat_id')
//         .setDescription('ID чата Telegram')
//         .setRequired(true)
//     ),

//   new SlashCommandBuilder()
//     .setName('sendmess')
//     .setDescription('Send a message to a specified user')
//     .addStringOption(option =>
//       option.setName('user_id')
//         .setDescription('ID пользователя для отправки сообщения')
//         .setRequired(true)
//     )
//     .addStringOption(option =>
//       option.setName('message')
//         .setDescription('Сообщение для отправки')
//         .setRequired(true)
//     ),

//     new SlashCommandBuilder()
//     .setName('re')
//     .setDescription('Ответить на сообщение')
//     .addStringOption(option =>
//       option.setName('message')
//         .setDescription('Текст ответа')
//         .setRequired(true)
//     )

// ];
// Когда бот готов, выполняем регистрацию команд
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

//ДИСКОРД СОЕДИНЕНИЕ
const channelMappings = {};

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

    const embed = new EmbedBuilder()
      .setTitle('Связь установлена')
      .setDescription(`Канал ${discordChannel.name} связан с чатом Telegram ${telegramChatId}`)
      .setColor('#00FF00');

    await interaction.reply({ embeds: [embed] });
  } 
});



const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');





//Из Dискорд в телеграмм

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const channelId = message.channel.id;
  const telegramChatId = channelMappings[channelId];

  if (telegramChatId) {
    let messageContent = `[${message.author.username}] ${message.content}`;

    // Check if the message is a reply
    if (message.reference) {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      const repliedMessageContent = `[${repliedMessage.author.username}] ${repliedMessage.content}`;
      messageContent = `\n> ${repliedMessageContent}: \n${messageContent}`;
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

      const embed = new EmbedBuilder()
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

        fileStream.on('finish', () => {
          // Convert "oga" to "mp3"
          ffmpeg(inputFilePath)
            .toFormat('mp3')
            .on('end', () => {
              console.log('Конвертация завершена.');
              // Отправка сконвертированного файла в Discord
              const convertedFileStream = outputFilePath;
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


// Заdумка, крч когdа ты в голосовом мог записать голосовое увеdомление в течении 10 секунd
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

  //RoleChanger
  client.on('messageCreate', message => {
    const roleIds = ['1078503876375892111', '1078503892922404975', '1078503890619732008']; // менять роли
    let intervalId;
    
    function changeRole() {
      const member = message.guild.members.cache.get(message.author.id);
      if (!member) {
        console.error('Member not found');
        return;
      }
      const randomRole = roleIds[Math.floor(Math.random() * roleIds.length)];
      const role = message.guild.roles.cache.get(randomRole);
      member.roles.set([role]).catch(console.error);
    }
    
    if (message.content === '!changerole') {
      intervalId = setInterval(changeRole, 5000); 
      message.channel.send('Роль будет меняться каждые 5 секунды!');
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
      await user.send(`📩 Анонимное сообщение:\n${messageText}\n\nОтветить: /re [сообщение]`);

      // Сохраняем связь: получатель → отправитель
      if (!global.messageLinks) global.messageLinks = new Map();
      global.messageLinks.set(userId, interaction.user.id); // userId получателя → ID отправителя

      await interaction.reply({
        content: `✅ Сообщение отправлено пользователю <@${userId}>`,
        flags: 64
      });

    } catch (error) {
      await interaction.reply({
        content: `❌ Ошибка: ${error.message}`,
        flags: 64
      });
    }
  }

  // Обработка команды /re
  if (interaction.commandName === 're') {
    const replyText = interaction.options.getString('message');

    try {
      // Получаем ID оригинального отправителя
      const originalSenderId = global.messageLinks?.get(interaction.user.id);

      if (!originalSenderId) {
        return interaction.reply({
          content: "❌ Нет сообщений для ответа. Сначала отправьте кому-то сообщение через /sendmess",
          flags: 64
        });
      }

      // Отправляем ответ
      const originalSender = await client.users.fetch(originalSenderId);
      await originalSender.send(`📨 Ответ на ваше сообщение:\n${replyText}`);

      // Обновляем связь для цепочки ответов
      global.messageLinks.set(originalSenderId, interaction.user.id);

      await interaction.reply({
        content: "✅ Ответ отправлен!",
        flags: 64
      });

    } catch (error) {
      await interaction.reply({
        content: `❌ Ошибка: ${error.message}`,
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