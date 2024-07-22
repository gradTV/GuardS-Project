const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');


const config = require('../config.json');
const BrawlToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6IjQ0ZWEyYjRjLWYyOGUtNDc3MS1iOWM0LWQxNTU5OWI0ZjdiZCIsImlhdCI6MTcxMTIwNDkzNywic3ViIjoiZGV2ZWxvcGVyLzM0MmVmNGYxLTA3ZWYtZWE3MC05ODc3LWMyNTg3ZmRmMzA4YiIsInNjb3BlcyI6WyJicmF3bHN0YXJzIl0sImxpbWl0cyI6W3sidGllciI6ImRldmVsb3Blci9zaWx2ZXIiLCJ0eXBlIjoidGhyb3R0bGluZyJ9LHsiY2lkcnMiOlsiOTEuMTIzLjE1MC4xNzEiXSwidHlwZSI6ImNsaWVudCJ9XX0.bgDnF7I7aS1t-wKyDbQaVXuNFWD6ogyf34Io1V5u91Hlr2wt91uXPAARZGe2nELpCbTq9TsgfqwiD-yW5Nu0yQ'

const MembersPerPage = 10; // Количество участников на странице
let clanMessage;
let collector; // Переменная для хранения коллектора

async function getClanInfo(channel, currentPage = 1) {
  try {
    if (collector) {
      // Если коллектор уже существует, удаляем его реакции и останавливаем его
      clanMessage.reactions.removeAll();
      collector.stop();
    }

    const response = await axios.get('https://api.brawlstars.com/v1/clubs/%23C220VLR', {
      headers: {
        Authorization: `Bearer ${BrawlToken}`
      }
    });

    const clanData = response.data;
    const totalPages = Math.ceil(clanData.members.length / MembersPerPage);

    if (currentPage < 1 || currentPage > totalPages) {
      await channel.send('Недопустимый номер страницы.');
      return;
    }

    const canvas = createCanvas(400, 600);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';

    const startIndex = (currentPage - 1) * MembersPerPage;
    const endIndex = Math.min(currentPage * MembersPerPage, clanData.members.length);

    ctx.fillText(`Название клана: ${clanData.name}`, 10, 20);
    ctx.fillText(`Трофеи клана: ${clanData.trophies}`, 10, 60);
    ctx.fillText(`Участники клана (страница ${currentPage} из ${totalPages}):`, 10, 100);
    const trophyImage = await loadImage('./brawl/trophy.png');
    
    for (let i = startIndex; i < endIndex; i++) {
      const member = clanData.members[i];
      const text = `${i + 1}. ${member.name} - ${member.trophies}`;
      const textWidth = ctx.measureText(text).width;
      const textY = 160 + (i % MembersPerPage) * 40;   //высота текста участников
    
      // Отображаем текст о количестве кубков
      ctx.fillText(text, 50, textY);
    
      // Отображаем изображение стикера рядом с текстом, с учетом ширины текста
      ctx.drawImage(trophyImage, 50 + textWidth + 10, textY - 30, 40, 40); // Размеры стикера 30x30, с отступом от текста 10 пикселей
    }
    const buffer = canvas.toBuffer('image/png');

    if (!clanMessage) {
      clanMessage = await channel.send({ content: 'Информация о клане Brawl Stars:', files: [buffer] });
    } else {
      await clanMessage.edit({ content: 'Информация о клане Brawl Stars:', files: [buffer] });
    }

    if (totalPages > 1) {
      await clanMessage.react('◀️');
      await clanMessage.react('▶️');
      const filter = (reaction, user) => ['◀️', '▶️'].includes(reaction.emoji.name) && user.id === message.author.id;
      collector = clanMessage.createReactionCollector(filter, { time: 60000 });

      collector.on('collect', async (reaction) => {
        try {
          if (reaction.emoji.name === '◀️') {
            currentPage = Math.max(currentPage - 1);
          } else if (reaction.emoji.name === '▶️') {
            currentPage = Math.min(currentPage + 1, totalPages);
          }

          await getClanInfo(channel, currentPage);
        } catch (error) {
          console.error('Произошла ошибка:', error.message);
          await channel.send('Произошла ошибка при получении информации о клане.');
        }
      });
    }
  } catch (error) {
    console.error('Произошла ошибка:', error.message);
    await channel.send('Произошла ошибка при получении информации о клане.');
  }
}

module.exports = {
  getClanInfo: getClanInfo
};