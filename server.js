import discord
import asyncio
from discord.ext import commands
from discord import app_commands
import os
import random
import string

intents = discord.Intents.default()
intents.guilds = True
intents.messages = True
intents.message_content = True
bot = commands.Bot(command_prefix="/", intents=intents)

spamming_flags = {}
personal_spam_tasks = {}

def base_embed(title, description, success=True):
    color = discord.Color.orange()
    embed = discord.Embed(
        title=title,
        description=description,
        color=color
    )
    embed.set_footer(text="Valentine V1 - System")
    return embed

@bot.event
async def on_ready():
    try:
        await bot.wait_until_ready()
        await bot.tree.sync()
        await bot.change_presence(
            status=discord.Status.dnd,
            activity=discord.CustomActivity(name="spamming everyone")
        )
        print(f"Synced commands. Logged in as {bot.user}")
    except Exception as e:
        print(f"Startup error: {e}")

@bot.tree.command(name="spam", description="Spams pings in all channels except cmds, announcements, invite, update logs")
@app_commands.describe(type="Type of spam: all, everyone, here")
async def spam(interaction: discord.Interaction, type: str):
    try:
        guild_id = interaction.guild.id
        type = type.lower()

        if type not in ["all", "everyone", "here"]:
            await interaction.response.send_message(embed=base_embed("Invalid Type", "Supported types: all, everyone, here"), ephemeral=True)
            return

        if spamming_flags.get(guild_id, False):
            await interaction.response.send_message(embed=base_embed("Already Running", "Spamming is already active in this server."), ephemeral=True)
            return

        spamming_flags[guild_id] = True
        await interaction.response.send_message(embed=base_embed("Spamming Started", f"Spamming with type **{type}**"), ephemeral=True)

        while spamming_flags[guild_id]:
            for channel in interaction.guild.text_channels:
                name_lower = channel.name.lower()
                if any(skip in name_lower for skip in ["cmds", "announcements", "invite", "📋update-logs"]):
                    continue
                try:
                    if type == "all":
                        await channel.send("@everyone @here ping")
                    elif type == "everyone":
                        await channel.send("@everyone ping")
                    elif type == "here":
                        await channel.send("@here ping")
                except Exception as e:
                    print(f"Error sending message to {channel.name}: {e}")
                    continue
            await asyncio.sleep(1)
    except Exception as e:
        await interaction.response.send_message(embed=base_embed("Unexpected Error", str(e)), ephemeral=True)

@bot.tree.command(name="end", description="Stops the spam")
async def end(interaction: discord.Interaction):
    guild_id = interaction.guild.id
    spamming_flags[guild_id] = False
    await interaction.response.send_message(embed=base_embed("Stopped", "Spamming has been stopped."), ephemeral=True)

@bot.tree.command(name="create", description="Create channels with name and deny speaking")
@app_commands.describe(name="Base name for the channels", amount="How many channels to create")
async def create(interaction: discord.Interaction, name: str, amount: int):
    if amount < 1 or amount > 100:
        await interaction.response.send_message(embed=base_embed("Invalid Amount", "Amount must be between 1 and 100."), ephemeral=True)
        return

    await interaction.response.send_message(embed=base_embed("Creating Channels", f"Creating {amount} channels..."), ephemeral=True)

    overwrite = {
        interaction.guild.default_role: discord.PermissionOverwrite(send_messages=False)
    }

    for i in range(1, amount + 1):
        channel_name = f"{name}-{i}"
        try:
            await interaction.guild.create_text_channel(name=channel_name, overwrites=overwrite)
        except Exception as e:
            print(f"Error creating channel {channel_name}: {e}")
            continue

    await interaction.followup.send(embed=base_embed("Done", "Channels created."), ephemeral=True)

@bot.tree.command(name="removec", description="Remove all channels containing the given name string, one by one")
@app_commands.describe(name="String to match in channel names")
async def removec(interaction: discord.Interaction, name: str):
    count = 0
    await interaction.response.send_message(embed=base_embed("Removing Channels", f"Removing channels containing **{name}**..."), ephemeral=True)

    for channel in interaction.guild.text_channels:
        if name.lower() in channel.name.lower():
            try:
                await channel.delete()
                count += 1
                await asyncio.sleep(1)
            except Exception as e:
                print(f"Error deleting channel {channel.name}: {e}")
                continue

    await interaction.followup.send(embed=base_embed("Removed", f"Removed {count} channels."), ephemeral=True)

@bot.tree.command(name="spamme", description="Creates a channel named after you and spams pinging you in it.")
async def spamme(interaction: discord.Interaction):
    user = interaction.user
    channel_name = user.name.lower()
    guild = interaction.guild

    old_channel = discord.utils.get(guild.text_channels, name=channel_name)
    if old_channel:
        try:
            await old_channel.delete()
        except Exception as e:
            print(f"Error deleting old channel: {e}")

    overwrite = {
        guild.default_role: discord.PermissionOverwrite(read_messages=False),
        user: discord.PermissionOverwrite(read_messages=True, send_messages=False)
    }

    try:
        channel = await guild.create_text_channel(name=channel_name, overwrites=overwrite)
    except Exception as e:
        await interaction.response.send_message(embed=base_embed("Channel Creation Failed", str(e)), ephemeral=True)
        return

    async def spam_user():
        while True:
            try:
                await channel.send(user.mention)
            except:
                break
            await asyncio.sleep(1)

    if personal_spam_tasks.get(user.id):
        personal_spam_tasks[user.id].cancel()

    task = asyncio.create_task(spam_user())
    personal_spam_tasks[user.id] = task

    await interaction.response.send_message(embed=base_embed("Channel Created", f"Created {channel.mention} and started spamming you there."), ephemeral=True)

@bot.tree.command(name="spammeend", description="Stops spam pinging you and deletes your channel.")
async def spammeend(interaction: discord.Interaction):
    user = interaction.user
    channel_name = user.name.lower()
    guild = interaction.guild

    if personal_spam_tasks.get(user.id):
        personal_spam_tasks[user.id].cancel()
        del personal_spam_tasks[user.id]

    channel = discord.utils.get(guild.text_channels, name=channel_name)
    if channel:
        try:
            await channel.delete()
        except Exception as e:
            print(f"Error deleting personal spam channel: {e}")

    await interaction.response.send_message(embed=base_embed("Stopped", "Stopped spam and removed your channel."), ephemeral=True)

@bot.tree.command(name="announce", description="Post an update log in 📋update-logs (CEO only)")
@app_commands.describe(
    option1="Update point 1", option2="Update point 2", option3="Update point 3",
    option4="Update point 4", option5="Update point 5", option6="Update point 6",
    option7="Update point 7", option8="Update point 8", option9="Update point 9",
    option10="Update point 10", option11="Update point 11", option12="Update point 12"
)
async def announce(interaction: discord.Interaction,
                   option1: str = None, option2: str = None, option3: str = None,
                   option4: str = None, option5: str = None, option6: str = None,
                   option7: str = None, option8: str = None, option9: str = None,
                   option10: str = None, option11: str = None, option12: str = None):
    member = interaction.guild.get_member(interaction.user.id)
    if not member or not any(role.name.lower() == "ceo" for role in member.roles):
        await interaction.response.send_message(embed=base_embed("Access Denied", "CEO role required."), ephemeral=True)
        return

    channel = discord.utils.get(interaction.guild.text_channels, name="📋update-logs")
    if not channel:
        await interaction.response.send_message(embed=base_embed("Missing Channel", "Update log channel not found."), ephemeral=True)
        return

    updates = [
        option1, option2, option3, option4, option5, option6,
        option7, option8, option9, option10, option11, option12
    ]
    updates = [u for u in updates if u and u.lower() != "nil"]

    version_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=20))

    embed = discord.Embed(
        title=f"spam-bot V-{version_code} Release",
        description="**Changelog**",
        color=discord.Color.orange()
    )
    for i, u in enumerate(updates, 1):
        embed.add_field(name=f"Update {i}", value=u, inline=False)
    embed.set_footer(text="Valentine V1 - System")

    await channel.send(embed=embed)
    await interaction.response.send_message(embed=base_embed("Announced", "Update log sent."), ephemeral=True)

bot.run(os.getenv("DISCORD_TOKEN"))
