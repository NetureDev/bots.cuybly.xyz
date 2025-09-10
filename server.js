// api/bot.js (for Vercel serverless functions)
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');

let client = null;
const spammingFlags = {};
const intervals = new Map();

function baseEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0xFFA500)
        .setFooter({ text: "Valentine V1 - System" });
}

async function initializeBot() {
    if (client && client.readyTimestamp) {
        return client;
    }

    client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
    });

    client.once('ready', () => {
        console.log(`Logged in as ${client.user.tag}`);
        client.user.setActivity('spamming everyone', { type: 4 }); // Custom activity type
    });

    // Register slash commands
    const commands = [
        {
            name: 'ping',
            description: 'Check if bot is responsive'
        },
        {
            name: 'spam',
            description: 'Start spamming channels',
            options: [
                {
                    name: 'type',
                    description: 'Type of spam',
                    type: 3, // STRING type
                    required: true,
                    choices: [
                        { name: 'All (@everyone @here)', value: 'all' },
                        { name: 'Everyone (@everyone)', value: 'everyone' },
                        { name: 'Here (@here)', value: 'here' }
                    ]
                }
            ]
        },
        {
            name: 'end',
            description: 'Stop spamming'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        try {
            if (commandName === 'ping') {
                await interaction.reply({ 
                    embeds: [baseEmbed('Pong!', 'Bot is alive and responsive!')], 
                    ephemeral: true 
                });
            }

            if (commandName === 'spam') {
                const type = interaction.options.getString('type').toLowerCase();
                const guildId = interaction.guild.id;

                if (spammingFlags[guildId]) {
                    return interaction.reply({ 
                        embeds: [baseEmbed('Already Running', 'Spamming is already active in this server.')], 
                        ephemeral: true 
                    });
                }

                spammingFlags[guildId] = true;
                await interaction.reply({ 
                    embeds: [baseEmbed('Spamming Started', `Spamming with type **${type}**`)], 
                    ephemeral: true 
                });

                const interval = setInterval(async () => {
                    if (!spammingFlags[guildId]) {
                        clearInterval(interval);
                        intervals.delete(guildId);
                        return;
                    }

                    const guild = client.guilds.cache.get(guildId);
                    if (!guild) {
                        clearInterval(interval);
                        intervals.delete(guildId);
                        spammingFlags[guildId] = false;
                        return;
                    }

                    for (const channel of guild.channels.cache.values()) {
                        if (!channel.isTextBased()) continue;
                        
                        const nameLower = channel.name.toLowerCase();
                        if (['cmds', 'announcements', 'invite', '📋update-logs'].some(skip => nameLower.includes(skip))) continue;

                        try {
                            let message = '';
                            if (type === 'all') message = '@everyone @here ping';
                            else if (type === 'everyone') message = '@everyone ping';
                            else if (type === 'here') message = '@here ping';

                            await channel.send(message);
                        } catch (e) {
                            console.log(`Error sending message to ${channel.name}: ${e.message}`);
                            continue;
                        }
                    }
                }, 1000);

                intervals.set(guildId, interval);
            }

            if (commandName === 'end') {
                const guildId = interaction.guild.id;
                spammingFlags[guildId] = false;
                
                if (intervals.has(guildId)) {
                    clearInterval(intervals.get(guildId));
                    intervals.delete(guildId);
                }

                await interaction.reply({ 
                    embeds: [baseEmbed('Stopped', 'Spamming has been stopped.')], 
                    ephemeral: true 
                });
            }
        } catch (error) {
            console.error('Error handling interaction:', error);
            if (!interaction.replied) {
                await interaction.reply({ 
                    embeds: [baseEmbed('Error', 'An error occurred while processing your command.')], 
                    ephemeral: true 
                });
            }
        }
    });

    await client.login(process.env.DISCORD_TOKEN);
    
    // Register commands globally (you might want to do this only once)
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }

    return client;
}

// Serverless function handler
module.exports = async (req, res) => {
    try {
        await initializeBot();
        res.status(200).json({ status: 'Bot is running' });
    } catch (error) {
        console.error('Error initializing bot:', error);
        res.status(500).json({ error: 'Failed to initialize bot' });
    }
};

// Keep the connection alive (for serverless environments)
setInterval(() => {
    if (client && client.readyTimestamp) {
        console.log('Bot is still alive');
    }
}, 30000); // Ping every 30 seconds
