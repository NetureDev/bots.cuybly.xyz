const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const spammingFlags = {};
const personalSpamTasks = new Map();

function baseEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0xFFA500) // orange
        .setFooter({ text: "Valentine V1 - System" });
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('spamming everyone', { type: 'CUSTOM' });
});

// Example slash command using discord.js v14
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'ping') {
        await interaction.reply({ embeds: [baseEmbed('Pong!', 'Bot is alive and responsive!')], ephemeral: true });
    }

    if (commandName === 'spam') {
        const type = interaction.options.getString('type').toLowerCase();
        const guildId = interaction.guild.id;

        if (!['all', 'everyone', 'here'].includes(type)) {
            return interaction.reply({ embeds: [baseEmbed('Invalid Type', 'Supported types: all, everyone, here')], ephemeral: true });
        }

        if (spammingFlags[guildId]) {
            return interaction.reply({ embeds: [baseEmbed('Already Running', 'Spamming is already active in this server.')], ephemeral: true });
        }

        spammingFlags[guildId] = true;
        await interaction.reply({ embeds: [baseEmbed('Spamming Started', `Spamming with type **${type}**`)], ephemeral: true });

        const interval = setInterval(async () => {
            if (!spammingFlags[guildId]) {
                clearInterval(interval);
                return;
            }

            for (const channel of interaction.guild.channels.cache.values()) {
                if (!channel.isTextBased()) continue;
                const nameLower = channel.name.toLowerCase();
                if (['cmds', 'announcements', 'invite', '📋update-logs'].some(skip => nameLower.includes(skip))) continue;

                try {
                    if (type === 'all') await channel.send('@everyone @here ping');
                    if (type === 'everyone') await channel.send('@everyone ping');
                    if (type === 'here') await channel.send('@here ping');
                } catch (e) {
                    console.log(`Error sending message to ${channel.name}: ${e}`);
                    continue;
                }
            }
        }, 1000);
    }

    if (commandName === 'end') {
        spammingFlags[interaction.guild.id] = false;
        await interaction.reply({ embeds: [baseEmbed('Stopped', 'Spamming has been stopped.')], ephemeral: true });
    }
});

// Login
client.login(process.env.DISCORD_TOKEN);
