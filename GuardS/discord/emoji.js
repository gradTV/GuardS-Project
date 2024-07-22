const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

config = require('../config.json');
const token = config.token;

exports.run = async (emojiName, stickerId, action, message) => {
    try {
        await client.login(token);

        client.on('ready', () => {
            console.log(`Logged in as ${client.user.tag}!`);
        });

        client.on('messageCreate', async (msg) => {
            if (msg.content === message) {
                const emoji = msg.guild.emojis.cache.find(e => e.name === emojiName);
                if (action === 'addEmoji' && emoji) {
                    await msg.react(emoji);
                    console.log(`Added emoji ${emojiName} to the message.`);
                } else if (action === 'removeEmoji' && emoji) {
                    const userReactions = msg.reactions.cache.filter(reaction => reaction.emoji.name === emojiName);
                    for (const reaction of userReactions.values()) {
                        await reaction.users.remove(client.user.id);
                    }
                    console.log(`Removed emoji ${emojiName} from the message.`);
                } else if (action === 'sendSticker') {
                    await msg.reply({ stickers: [stickerId] });
                    console.log(`Sent sticker with ID ${stickerId}.`);
                }
            }
        });
    } catch (error) {
        console.error('Error managing emoji or sticker:', error);
    }
};