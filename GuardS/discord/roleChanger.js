const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');

const activeChangers = new Map(); // key: `${guildId}-${userId}`

const commandData = new SlashCommandBuilder()
  .setName('changerole')
  .setDescription('Cyclic role color change')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addStringOption(o =>
    o.setName('action')
      .setDescription('Choose an action')
      .setRequired(true)
      .addChoices(
        { name: 'add — start cycle', value: 'add' },
        { name: 'stop — stop cycle', value: 'stop' }
      )
  )
  .addRoleOption(o => o.setName('role1').setDescription('First role'))
  .addRoleOption(o => o.setName('role2').setDescription('Second role'))
  .addRoleOption(o => o.setName('role3').setDescription('Role 3'))
  .addRoleOption(o => o.setName('role4').setDescription('Role 4'))
  .addRoleOption(o => o.setName('role5').setDescription('Role 5'));

const roleChanger = {
  init(client) {
    // Registration of the command
    client.once('ready', async () => {
      const rest = new REST({ version: '9' }).setToken(client.token);
        await rest.put(
          Routes.applicationCommands(client.user.id),
          { body: [commandData.toJSON()] }
        );
    });

    // Interaction handling
    client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand() || interaction.commandName !== 'changerole') return;

      const action = interaction.options.getString('action');
      const guild = interaction.guild;
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      
      const key = `${guild.id}-${interaction.user.id}`;

      // Stop the cycle
      if (action === 'stop') {
        const entry = activeChangers.get(key);
        if (!entry) {
          return interaction.reply({
            content: '⚠️ You have no active role cycle.',
            flags: MessageFlags.Ephemeral
          });
        }

        clearInterval(entry.intervalId);
        activeChangers.delete(key);

        return interaction.reply({
          content: '🛑 Role cycle has been stopped.',
          flags: MessageFlags.Ephemeral
        });
      }

      // Add roles
      if (action === 'add') {
        const roles = [];

        const role1 = interaction.options.getRole('role1');
        const role2 = interaction.options.getRole('role2');
        roles.push(role1, role2);

        for (let i = 3; i <= 5; i++) {
          const role = interaction.options.getRole(`role${i}`);
          if (role) roles.push(role);
        }

        if (activeChangers.has(key)) {
          clearInterval(activeChangers.get(key).intervalId);
          activeChangers.delete(key);
        }

        let index = 0;
        const roleMap = roles.map(r => r.id);

        const intervalId = setInterval(async () => {
            const refreshedMember = await guild.members.fetch(member.id).catch(() => null);
            if (!refreshedMember) return clearInterval(intervalId);

            const nextRole = roles[index].id;

            // Filter out all roles currently in the cycle, then add the next one
            const otherRoles = refreshedMember.roles.cache
              .filter(r => !roleMap.includes(r.id) && r.id !== guild.id)
              .map(r => r.id);

            otherRoles.push(nextRole);

            // Set the new roleset in a single API call to prevent flickering
            await refreshedMember.roles.set(otherRoles);

            index = (index + 1) % roles.length;
        }, 3000);

        activeChangers.set(key, { intervalId, roles });

        const list = roles.map(r => `<@&${r.id}>`).join(', ');
        return interaction.reply({
          content: `✅ Role cycle started (3s interval).\n**Roles:** ${list}`,
          flags: MessageFlags.Ephemeral
        });
      }
    });
  }
};

module.exports = { roleChanger };