import discord
from discord import app_commands
import aiohttp
import asyncio
import logging
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
import re
import urllib.parse
import time
from typing import Set, Dict

# Cache for user IDs
USER_ID_CACHE = {}

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('discord')

# Enhanced error messages
API_ERROR_MESSAGES = {
    401: "API Token is invalid",
    429: "Rate limit exceeded, waiting...",
    500: "Server error, retrying...",
    503: "Service unavailable, retrying..."
}

# Bot configuration
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')
SAHARA_API_URL = os.getenv('SAHARA_API_URL')
API_HEADERS = {'x-api-key': '13f0868c-0a20-4b17-a3f5-bac5c6dee4d0'}
ENGAGE_API_URL = os.getenv('ENGAGE_API_URL')
ENGAGE_API_TOKEN = os.getenv('ENGAGE_API_TOKEN')
LOG_CHANNEL_ID = int(os.getenv('LOG_CHANNEL_ID'))
SAHARA_GUILD_ID = int(os.getenv('SAHARA_GUILD_ID'))
PAUSED_EVENTS = set()  # Stores IDs of paused events

# List of authorized Discord user IDs
AUTHORIZED_USERS = [int(id.strip()) for id in os.getenv('AUTHORIZED_USERS').split(',')]

# Rate limiting configuration
RATE_LIMIT = {
    'requests_per_minute': 30,  # Maximum requests per minute
    'delay_between_requests': 0.5,  # Delay between requests in seconds
    'last_request_time': None
}

WHITELIST_SECRET = os.getenv('WHITELIST_SECRET')

class PauseManager:
    def __init__(self):
        self.paused_events: Dict[str, float] = {}
        self.pause_file = "paused_events.json"
        self._load_paused_events()

    def _load_paused_events(self):
        """Loads the list of paused events from a file"""
        try:
            if os.path.exists(self.pause_file):
                with open(self.pause_file, 'r') as f:
                    self.paused_events = json.load(f)
        except Exception as e:
            logger.error(f"Error loading paused events: {e}")
            self.paused_events = {}

    def _save_paused_events(self):
        """Saves the list of paused events to a file"""
        try:
            with open(self.pause_file, 'w') as f:
                json.dump(self.paused_events, f)
        except Exception as e:
            logger.error(f"Error saving paused events: {e}")

    def pause_event(self, event_id: str) -> bool:
        """Pauses an event"""
        if event_id not in self.paused_events:
            self.paused_events[event_id] = time.time()
            self._save_paused_events()
            return True
        return False

    def resume_event(self, event_id: str) -> bool:
        """Resumes an event"""
        if event_id in self.paused_events:
            del self.paused_events[event_id]
            self._save_paused_events()
            return True
        return False

    def is_paused(self, event_id: str) -> bool:
        """Checks if an event is paused"""
        return event_id in self.paused_events

    def get_pause_duration(self, event_id: str) -> float:
        """Returns the duration of the pause in seconds"""
        if event_id in self.paused_events:
            return time.time() - self.paused_events[event_id]
        return 0

class DistributionProgress:
    def __init__(self):
        self.progress_file = "distribution_progress.json"
        self.active_distributions = {}  # event_id -> progress_data
        self._load_progress()

    def _load_progress(self):
        """Loads distribution progress from a file"""
        try:
            if os.path.exists(self.progress_file):
                with open(self.progress_file, 'r') as f:
                    self.active_distributions = json.load(f)
        except Exception as e:
            logger.error(f"Error loading distribution progress: {e}")
            self.active_distributions = {}

    def _save_progress(self):
        """Saves distribution progress to a file"""
        try:
            with open(self.progress_file, 'w') as f:
                json.dump(self.active_distributions, f)
        except Exception as e:
            logger.error(f"Error saving distribution progress: {e}")

    def start_distribution(self, event_id: str, distributions: list):
        """Starts a new distribution"""
        self.active_distributions[event_id] = {
            'distributions': distributions,
            'current_dist_index': 0,
            'current_user_index': 0,
            'completed_users': [],  # Changed to list for JSON serialization
            'start_time': time.time()
        }
        self._save_progress()

    def update_progress(self, event_id: str, dist_index: int, user_index: int, user_id: str):
        """Updates distribution progress"""
        if event_id in self.active_distributions:
            self.active_distributions[event_id]['current_dist_index'] = dist_index
            self.active_distributions[event_id]['current_user_index'] = user_index
            if user_id and user_id not in self.active_distributions[event_id]['completed_users']:
                self.active_distributions[event_id]['completed_users'].append(user_id)
            self._save_progress()

    def get_progress(self, event_id: str):
        """Gets the current distribution progress"""
        return self.active_distributions.get(event_id)

    def remove_distribution(self, event_id: str):
        """Removes a distribution after completion"""
        if event_id in self.active_distributions:
            del self.active_distributions[event_id]
            self._save_progress()

# Create global instances of managers
pause_manager = PauseManager()
distribution_manager = DistributionProgress()

class OPBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        intents.members = True
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self):
        # Only allow commands in the specified guild
        whitelist_commands = WhitelistCommands()
        self.tree.add_command(whitelist_commands, guild=discord.Object(id=SAHARA_GUILD_ID))
        await self.tree.sync(guild=discord.Object(id=SAHARA_GUILD_ID))

    async def on_guild_join(self, guild):
        """Handle when bot joins a guild."""
        if guild.id != SAHARA_GUILD_ID:
            logger.warning(f"Bot joined unauthorized guild {guild.name} ({guild.id}). Leaving...")
            await guild.leave()

    async def format_log_embed(self, logs, log_type=None):
        """Format logs into a Discord embed."""
        embed = discord.Embed(
            title="🔔 New Site Activity",
            description=f"New activity detected" + (f" ({log_type})" if log_type else ""),
            color=discord.Color.blue(),
            timestamp=datetime.utcnow()
        )

        for log in logs:
            timestamp = datetime.fromisoformat(log['timestamp'].replace('Z', '+00:00'))
            user = log.get('user', 'System')
            action = log.get('action', 'Unknown action')
            details = log.get('details', '')

            # Choose emoji based on log type
            type_emoji = {
                'login': '🔐',
                'event': '📅',
                'whitelist': '📝',
                'other': '📌'
            }.get(log.get('type', 'other'), '📌')

            # Format log entry
            log_text = f"**User:** {user}\n"
            log_text += f"**Action:** {action}\n"
            if details:
                log_text += f"**Details:** {details}\n"

            # Add field for this log
            embed.add_field(
                name=f"{type_emoji} {timestamp.strftime('%Y-%m-%d %H:%M:%S')}",
                value=log_text,
                inline=False
            )

        return embed

    async def check_logs_background_task(self):
        """Background task to check for new logs."""
        await self.wait_until_ready()
        self.log_channel = self.get_channel(LOG_CHANNEL_ID)

        if not self.log_channel:
            logger.error(f"Could not find log channel with ID {LOG_CHANNEL_ID}")
            return

        while not self.is_closed():
            try:
                # Get new logs from API
                base_url = SAHARA_API_URL.rstrip('/')
                url = f"{base_url}/api/logs"

                params = {
                    'after': self.last_log_time.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                    'limit': 10  # Fetch up to 10 new logs at a time
                }

                headers = {
                    'Content-Type': 'application/json',
                    'x-api-key': API_HEADERS['x-api-key']
                }

                async with aiohttp.ClientSession() as session:
                    async with session.get(url, params=params, headers=headers) as response:
                        if response.status == 200:
                            logs_data = await response.json()
                            new_logs = logs_data.get('logs', [])

                            if new_logs:
                                # Group logs by type
                                grouped_logs = {}
                                for log in new_logs:
                                    log_type = log.get('type', 'other')
                                    if log_type not in grouped_logs:
                                        grouped_logs[log_type] = []
                                    grouped_logs[log_type].append(log)

                                # Send embed for each type of logs
                                for log_type, logs in grouped_logs.items():
                                    embed = await self.format_log_embed(logs, log_type)
                                    await self.log_channel.send(embed=embed)

                                # Update last check time
                                if new_logs:
                                    latest_time = max(
                                        datetime.fromisoformat(log['timestamp'].replace('Z', '+00:00'))
                                        for log in new_logs
                                    )
                                    self.last_log_time = latest_time

            except Exception as e:
                logger.error(f"Error in log checking task: {e}")

            # Wait before next check
            await asyncio.sleep(30)  # Check every 30 seconds

client = OPBot()

@client.event
async def on_ready():
    logger.info(f'Bot is ready! Logged in as {client.user}')
    try:
        synced = await client.tree.sync()
        logger.info(f"Synced {len(synced)} command(s)")
    except Exception as e:
        logger.error(f"Failed to sync commands: {e}")

async def get_event_distributions(session: aiohttp.ClientSession, event_id: str):
    """Get distribution information from event."""
    try:
        event_id = int(event_id)
        base_url = SAHARA_API_URL.rstrip('/')
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': API_HEADERS['x-api-key']
        }
        url = f'{base_url}/api/events/{event_id}'
        logger.info(f"Fetching event distributions from: {url}")

        async with session.get(url, headers=headers) as response:
            if response.status == 200:
                event_data = await response.json()
                if not event_data:
                    logger.error(f"Event {event_id} returned empty data")
                    return None
                return event_data.get('distributions', [])
            else:
                error_text = await response.text()
                logger.error(f"Failed to get event {event_id}. Status: {response.status}, Error: {error_text}")
                return None
    except ValueError:
        logger.error(f"Invalid event ID format: {event_id}")
        return None
    except Exception as e:
        logger.error(f"Error getting event {event_id}: {e}")
        return None

async def get_event_status(event_id: str) -> dict:
    try:
        base_url = SAHARA_API_URL.rstrip('/')
        url = f"{base_url}/api/bot/events/{event_id}"
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': API_HEADERS['x-api-key']
        }

        logger.info(f"Fetching event status from: {url}")
        logger.info(f"Using headers: {headers}")

        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Error getting event {event_id}. Status: {response.status}, Response: {error_text}")
                    return None

                event_data = await response.json()
                return event_data
    except Exception as e:
        logger.error(f"Error getting event status: {e}")
        return None

async def send_op_to_user(session: aiohttp.ClientSession, user_id: str, points: int, reason: str = '', event_id: int = 0, delay: float = 0.5) -> bool:
    """Send OP to user through Engage API."""
    try:
        # Add delay to avoid rate limiting
        await asyncio.sleep(delay)

        # Form URL with parameters
        url = f"{os.getenv('ENGAGE_API_URL')}?userId={user_id}&points={points}"

        headers = {
            'x-api-key': os.getenv('ENGAGE_API_TOKEN'),
            'Content-Type': 'application/json'
        }

        logger.info(f"Sending {points} OP to user {user_id}")
        logger.debug(f"Request URL: {url}")
        logger.debug(f"Headers: {headers}")

        async with session.get(url, headers=headers) as response:
            response_text = await response.text()
            logger.debug(f"Response status: {response.status}")
            logger.debug(f"Response body: {response_text}")

            if response.status == 200:
                logger.info(f"Successfully sent {points} OP to user {user_id}")
                return True
            else:
                logger.error(f"Failed to send OP. Status: {response.status}, Response: {response_text}")
                return False

    except Exception as e:
        logger.error(f"Error sending OP to user {user_id}: {str(e)}")
        return False

async def update_event_status(session: aiohttp.ClientSession, event_id: str, status: str) -> bool:
    """Updates the event status via API."""
    try:
        # Log initial parameters
        logger.info(f"Starting status update for event {event_id} to status {status}")

        # Form URL and remove double slashes
        base_url = SAHARA_API_URL.rstrip('/')
        full_url = f'{base_url}/api/bot/events/{event_id}'
        logger.info(f"Request URL: {full_url}")

        # Prepare headers and data (use the same as in test_api.js)
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': '13f0868c-0a20-4b17-a3f5-bac5c6dee4d0',
            'Accept': 'application/json'
        }
        update_data = {
            'status': status,
            'editor': 'Bot',
            'changes': f'Status updated to {status}'
        }

        # Log headers and data
        logger.info(f"Request headers: {headers}")
        logger.info(f"Request data: {update_data}")

        # Make request with timeout
        async with session.put(
            full_url,
            headers=headers,
            json=update_data,
            timeout=30
        ) as response:
            # Get response
            response_text = await response.text()
            logger.info(f"Response status: {response.status}")
            logger.info(f"Response body: {response_text}")

            if response.status == 200:
                logger.info(f"Successfully updated event {event_id} status to {status}")
                return True

            logger.error(f"Failed to update status. Status code: {response.status}")
            logger.error(f"Error response: {response_text}")
            return False

    except Exception as e:
        logger.error(f"Error updating event status: {str(e)}")
        return False

async def get_user_id_by_name(guild: discord.Guild, username: str) -> str:
    """Gets the Discord ID of a user by their name or ID."""
    try:
        # Trim whitespace from the name
        username = username.strip()

        # If ID is passed directly
        if username.isdigit():
            # Check if a user with this ID exists
            member = guild.get_member(int(username))
            if member:
                logger.info(f"Found user by ID: {username}")
                return username

        # Trim special characters (@, leading/trailing spaces) from the name
        clean_name = username.lstrip('@').strip()

        # First, search for an exact match by global_name
        member = discord.utils.get(guild.members, global_name=clean_name)
        if member:
            logger.info(f"Found user by global_name: {clean_name} -> {member.id}")
            return str(member.id)

        # Then, search by username
        member = discord.utils.get(guild.members, name=clean_name)
        if member:
            logger.info(f"Found user by username: {clean_name} -> {member.id}")
            return str(member.id)

        # If not found, log an error
        logger.error(f"Could not find user with name/id: {username}")
        return None

    except Exception as e:  
        logger.error(f"Error getting user ID for {username}: {str(e)}")
        return None

@client.tree.command(name="sendop", description="Send OP to users from event", guild=discord.Object(id=SAHARA_GUILD_ID))
@app_commands.describe(event_id="Event ID (numbers only)")
async def send_op_command(interaction: discord.Interaction, event_id: str):
    try:
        # Check if command is used in the correct guild
        if interaction.guild_id != SAHARA_GUILD_ID:
            await interaction.response.send_message("This command can only be used in the authorized server.", ephemeral=True)
            return

        if not interaction.response.is_done():
            await interaction.response.defer()

        if interaction.user.id not in AUTHORIZED_USERS:
            await interaction.followup.send("You are not authorized to use this command.", ephemeral=True)
            return

        if pause_manager.is_paused(event_id):
            await interaction.followup.send(
                embed=discord.Embed(
                    title="⏸️ Event Paused",
                    description=f"Event #{event_id} is currently paused.\n"
                               f"Use `/resume {event_id}` to continue distribution.",
                    color=discord.Color.orange()
                ),
                ephemeral=True
            )
            return

        event_data = await get_event_status(event_id)
        if not event_data:
            await interaction.followup.send(f"❌ Cannot distribute OP: Unable to get status for Event #{event_id}", ephemeral=True)
            return

        if event_data.get('status', '').lower() != 'pending':
            await interaction.followup.send(
                f"❌ Cannot distribute OP: Event #{event_id} is not in Pending status (current status: {event_data.get('status')})",
                ephemeral=True
            )
            return

        distributions = event_data.get('distributions', [])
        if not distributions:
            await interaction.followup.send(f"❌ No distributions found in Event #{event_id}", ephemeral=True)
            return

        # Format the date in the required format
        event_date = datetime.fromisoformat(event_data.get('eventDate').replace('Z', '+00:00')).strftime('%Y-%m-%d')
        
        success, summary_message = await process_single_event(interaction, event_id, interaction.channel)

        if not success and pause_manager.is_paused(event_id):
            return
        elif not success:
            await interaction.followup.send("❌ Failed to process event", ephemeral=True)

    except Exception as e:
        logger.error(f"Error in send_op_command: {str(e)}")
        await interaction.followup.send(f"❌ An error occurred: {str(e)}", ephemeral=True)

@client.tree.command(name="setstatus", description="Set event status (Admin only)", guild=discord.Object(id=SAHARA_GUILD_ID))
@app_commands.describe(
    event_id="Event ID",
    status="New status"
)
@app_commands.choices(status=[
    app_commands.Choice(name="Pending 🟠", value="Pending"),
    app_commands.Choice(name="Completed ✅", value="Completed"),
    app_commands.Choice(name="Rejected ❌", value="Rejected")
])
async def set_status_command(interaction: discord.Interaction, event_id: str, status: app_commands.Choice[str]):
    """Command to update the event status."""
    if interaction.guild_id != SAHARA_GUILD_ID:
        await interaction.response.send_message("This command can only be used in the authorized server.", ephemeral=True)
        return

    if interaction.user.id not in AUTHORIZED_USERS:
        await interaction.response.send_message("You are not authorized to use this command.", ephemeral=True)
        return

    try:
        await interaction.response.send_message(f"Updating event {event_id} status to {status.value}...")

        async with aiohttp.ClientSession() as session:
            success = await update_event_status(session, event_id, status.value)

            if success:
                await interaction.followup.send(f"✅ Successfully updated event {event_id} status to {status.value}", ephemeral=True)
            else:
                await interaction.followup.send(f"❌ Failed to update event {event_id} status")

    except Exception as e:
        logger.error(f"Error in set_status_command: {e}")
        await interaction.followup.send(f"An error occurred: {str(e)}", ephemeral=True)

@client.tree.command(name="pause", description="Pause OP distribution for an event", guild=discord.Object(id=SAHARA_GUILD_ID))
@app_commands.describe(event_id="Event ID to pause")
async def pause_distribution(interaction: discord.Interaction, event_id: str):
    """Pauses OP distribution for the specified event."""
    if interaction.guild_id != SAHARA_GUILD_ID:
        await interaction.response.send_message("This command can only be used in the authorized server.", ephemeral=True)
        return

    if interaction.user.id not in AUTHORIZED_USERS:
        await interaction.response.send_message(
            "You are not authorized to use this command.",
            ephemeral=True
        )
        return

    try:
        # Check if event exists
        event_data = await get_event_status(event_id)
        if not event_data:
            await interaction.response.send_message(
                f"❌ Event #{event_id} not found.",
                ephemeral=True
            )
            return

        if pause_manager.pause_event(event_id):
            embed = discord.Embed(
                title="⏸️ Distribution Paused",
                description=f"Distribution for Event #{event_id} has been paused.",
                color=discord.Color.orange()
            )
            embed.add_field(
                name="Event Details",
                value=f"Title: {event_data.get('title', 'N/A')}\n"
                      f"Status: {event_data.get('status', 'N/A')}"
            )
            await interaction.response.send_message(embed=embed)
        else:
            duration = pause_manager.get_pause_duration(event_id)
            embed = discord.Embed(
                title="ℹ️ Already Paused",
                description=f"Event #{event_id} is already paused.\n"
                           f"Paused for: {duration:.0f} seconds",
                color=discord.Color.blue()
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
    except Exception as e:
        logger.error(f"Error in pause_distribution: {e}")
        await interaction.response.send_message(
            f"❌ An error occurred: {str(e)}",
            ephemeral=True
        )

@client.tree.command(name="resume", description="Resume OP distribution for an event", guild=discord.Object(id=SAHARA_GUILD_ID))
@app_commands.describe(event_id="Event ID to resume")
async def resume_distribution(interaction: discord.Interaction, event_id: str):
    """Resumes OP distribution for the specified event."""
    if interaction.guild_id != SAHARA_GUILD_ID:
        await interaction.response.send_message("This command can only be used in the authorized server.", ephemeral=True)
        return

    if interaction.user.id not in AUTHORIZED_USERS:
        await interaction.response.send_message(
            "You are not authorized to use this command.",
            ephemeral=True
        )
        return

    try:
        if pause_manager.resume_event(event_id):
            progress = distribution_manager.get_progress(event_id)

            embed = discord.Embed(
                title="▶️ Distribution Resumed",
                description=f"Distribution for Event #{event_id} has been resumed.",
                color=discord.Color.green()
            )

            if progress:
                completed = len(progress['completed_users'])
                total_distributions = len(progress['distributions'])
                current_dist = progress['current_dist_index'] + 1

                embed.add_field(
                    name="Progress",
                    value=f"Distribution: {current_dist}/{total_distributions}\n"
                          f"Completed users: {completed}",
                    inline=False
                )

            await interaction.response.send_message(embed=embed)

            # Automatically continue distribution
            if progress:
                await process_single_event(interaction, event_id, interaction.channel)
            else:
                embed = discord.Embed(
                title="ℹ️ Not Paused",
                description=f"Event #{event_id} is not currently paused.",
                color=discord.Color.blue()
            )
            await interaction.response.send_message(embed=embed)
    except Exception as e:
        logger.error(f"Error in resume_distribution: {e}")
        await interaction.response.send_message(
            f"❌ An error occurred: {str(e)}",
            ephemeral=True
        )

async def process_single_event(interaction: discord.Interaction, event_id: str, log_channel):
    try:
        event_data = await get_event_status(event_id)
        if not event_data:
            await interaction.followup.send(f"❌ Failed to get event {event_id} data", ephemeral=True)
            return False, None

        # Format the date in the required format
        event_date = datetime.fromisoformat(event_data.get('eventDate').replace('Z', '+00:00')).strftime('%Y-%m-%d')

        total_users = 0
        successful_sends = 0
        failed_users = {}
        not_in_server = {}

        # Create initial embed in the new style
        start_embed = discord.Embed(
            title="🚀 Starting OP Distribution",
            color=discord.Color.blue()
        )
        start_embed.add_field(name="Event #", value=event_id, inline=True)
        start_embed.add_field(name="Event Title", value=event_data.get('title'), inline=True)
        start_embed.add_field(name="Requestor", value=f"{event_data.get('requestor')}", inline=True)
        start_embed.add_field(name="Event Date", value=event_date, inline=False)

        await interaction.followup.send(embed=start_embed)

        # Create session for HTTP requests
        async with aiohttp.ClientSession() as session:
            # Process each distribution
            distributions = event_data.get('distributions', [])
            for dist_index, dist in enumerate(distributions, 1):
                points = dist.get('xpAmount', 0)
                name_list = dist.get('nameList', '').split('\n')

                for username in name_list:
                    if not username.strip():
                        continue

                    total_users += 1
                    # Get Discord ID of the user
                    user_id = await get_user_id_by_name(interaction.guild, username.strip())

                    if not user_id:
                        logger.error(f"Could not find user ID for username: {username}")
                        if points not in failed_users:
                            failed_users[points] = []
                        failed_users[points].append(username.strip())
                        continue

                    # Check if the user is in the server
                    member = interaction.guild.get_member(int(user_id))
                    if not member:
                        logger.error(f"User {username} ({user_id}) is not in the server")
                        if points not in not_in_server:
                            not_in_server[points] = []
                        not_in_server[points].append(username.strip())
                        continue

                    # Send points
                    success = await send_op_to_user(
                        session=session,
                        user_id=user_id,
                        points=points,
                        reason=f"Event #{event_id}",
                        event_id=int(event_id)
                    )

                    if success:
                        successful_sends += 1
                        logger.info(f"Successfully sent {points} OP to {username} ({user_id})")
                        # Send message to channel about successful send
                        await interaction.followup.send(f"✅ Sent {points} OP to {member.mention}")
                    else:
                        if points not in failed_users:
                            failed_users[points] = []
                        failed_users[points].append(username.strip())
                        logger.error(f"Failed to send {points} OP to {username} ({user_id})")

            # Update event status
            status_updated = await update_event_status(session, event_id, "Completed")

        # Create embed with results in the new style
        embed = discord.Embed(
            title="📊 Distribution Summary",
            color=discord.Color.blue()
        )

        embed.add_field(name="Event #", value=event_id, inline=True)
        embed.add_field(name="Event Title", value=event_data.get('title'), inline=True)
        embed.add_field(name="Requestor", value=f"{event_data.get('requestor')}", inline=True)
        embed.add_field(name="Event Date", value=event_date, inline=False)

        # Add statistics
        stats_text = f"✅ Successfully sent: {successful_sends}/{total_users}\n"
        stats_text += f"❌ Failed: {sum(len(users) for users in failed_users.values())}\n"
        if not_in_server:
            stats_text += f"⚠️ Not in server: {sum(len(users) for users in not_in_server.values())}"

        embed.add_field(
            name="Statistics",
            value=stats_text,
            inline=False
        )

        # If there are users not in the server, add them to separate field
        if not_in_server:
            not_in_server_text = []
            for points, users in not_in_server.items():
                not_in_server_text.append(f"{points} OP\n```{chr(10).join(users)}```")

            embed.add_field(
                name="Users Not in Server",
                value="\n".join(not_in_server_text)[:1024],  # Discord limit
                inline=False
            )

        # If there are failed sends, add them to embed
        if failed_users:
            failed_text = []
            for points, users in failed_users.items():
                failed_text.append(f"{points} OP\n```{chr(10).join(users)}```")

            embed.add_field(
                name="Failed Users",
                value="\n".join(failed_text)[:1024],  # Discord limit
                inline=False
            )

        # Add status update field
        if status_updated:
            embed.add_field(name="Status", value="✅ Event status updated to Completed", inline=False)
        else:
            embed.add_field(name="Status", value="❌ Failed to update event status", inline=False)

        # Send results only once
        summary_message = await interaction.followup.send(embed=embed)

        return True, summary_message

    except Exception as e:
        logger.error(f"Error processing event {event_id}: {str(e)}")
        await interaction.followup.send(f"❌ Error processing event {event_id}: {str(e)}")
        return False, None

@client.tree.command(name="sendallop", description="Send OP for all pending events", guild=discord.Object(id=SAHARA_GUILD_ID))
async def send_all_op_command(interaction: discord.Interaction):
    if interaction.guild_id != SAHARA_GUILD_ID:
        await interaction.response.send_message("This command can only be used in the authorized server.", ephemeral=True)
        return

    try:
        await interaction.response.send_message("🔍 Fetching pending events...")
        command_channel = interaction.channel

        # Get list of all events using the same endpoint as in /sendop
        async with aiohttp.ClientSession() as session:
            base_url = SAHARA_API_URL.rstrip('/')
            url = f"{base_url}/api/bot/events"
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-api-key': os.getenv('ENGAGE_API_TOKEN')
            }

            # Add query parameters
            params = {
                'draw': '1',
                'start': '0',
                'length': '100',
                'search[value]': '',
                'order[0][column]': '0',
                'order[0][dir]': 'desc'
            }

            async with session.get(url, headers=headers, params=params, allow_redirects=False) as response:
                # If server redirects request, it means endpoint is incorrect
                if response.status in (301, 302, 303, 307, 308):
                    redirect_url = response.headers.get('Location', 'unknown')
                    logger.error(f"Redirection detected. Endpoint returned redirect to {redirect_url}")
                    await interaction.followup.send("❌ Failed to fetch events: received a redirect response, endpoint may be incorrect.")
                    return

                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Failed to fetch events. Status: {response.status}, Error: {error_text}")
                    await interaction.followup.send("❌ Failed to fetch events from the server.")
                    return

                events_data = await response.json()
                if not events_data.get('data'):
                    await interaction.followup.send("❌ No events found.")
                    return

                # Filter events with status Pending
                pending_events = [event for event in events_data['data'] if event.get('status') == 'Pending']

        if not pending_events:
            await interaction.followup.send("ℹ️ No pending events found.")
            return

        # Output information about found events
        start_embed = discord.Embed(
            title="🚀 Starting Mass OP Distribution",
            description=f"Found **{len(pending_events)}** pending events to process\n\n" +
                        "Events to process:\n" +
                        "\n".join([f"• Event #{event['id']} - {event['title']}" for event in pending_events]),
            color=discord.Color.blue()
        )
        initial_message = await command_channel.send(embed=start_embed)

        # Process each event
        total_processed = 0
        summary_links = []  # List to store links to messages with results
        for index, event in enumerate(pending_events, 1):
            success, summary_message = await process_single_event(interaction, str(event['id']), command_channel)
            if success:
                total_processed += 1
                if summary_message:
                    # Create link to message
                    message_link = f"[Event #{event['id']} Summary](https://discord.com/channels/{interaction.guild_id}/{command_channel.id}/{summary_message.id})"
                    summary_links.append(message_link)

            # Wait between processing
            await asyncio.sleep(1)

        # Output final statistics
        final_embed = discord.Embed(
            title="📊 Mass Distribution Complete",
            description=f"Successfully processed **{total_processed}/{len(pending_events)}** events",
            color=discord.Color.green() if total_processed == len(pending_events) else discord.Color.orange()
        )
        if summary_links:
            final_embed.add_field(
                name="Distribution Summaries",
                value="\n".join(summary_links),
                inline=False
            )
        await initial_message.reply(embed=final_embed)

    except Exception as e:
        logger.error(f"Error in send_all_op_command: {e}")
        await interaction.followup.send(f"❌ An error occurred while processing mass OP distribution: {str(e)}", ephemeral=True)

@client.tree.command(name="history", description="Show OP history for a user", guild=discord.Object(id=SAHARA_GUILD_ID))
@app_commands.describe(user="User to check history for")
async def history_command(interaction: discord.Interaction, user: discord.Member):
    """Command to show OP history for a user."""
    try:
        await interaction.response.defer(ephemeral=True)
        
        async with aiohttp.ClientSession() as session:
            # Используем правильный endpoint и заголовки
            base_url = SAHARA_API_URL.rstrip('/')
            url = f"{base_url}/api/bot/events"
            headers = {
                'Content-Type': 'application/json',
                'x-api-key': ENGAGE_API_TOKEN,
                'Accept': 'application/json'
            }
            
            async with session.get(url, headers=headers) as response:
                if response.status == 401:
                    await interaction.followup.send("❌ Unauthorized access. Please check API configuration.", ephemeral=True)
                    return
                    
                if not response.ok:
                    await interaction.followup.send(f"❌ Failed to fetch events: {response.status}", ephemeral=True)
                    return
                
                data = await response.json()
                if not data or 'data' not in data:
                    await interaction.followup.send("❌ No events data found", ephemeral=True)
                    return

                events = data['data']
                
                # Фильтруем завершенные события
                completed_events = [event for event in events if event['status'] == 'Completed']
                
                # Ищем пользователя в списках распределения
                user_events = []
                total_op = 0
                
                for event in completed_events:
                    for dist in event['distributions']:
                        names = [name.strip() for name in dist['nameList'].split('\n')]
                        # Проверяем все варианты имени пользователя
                        user_name = user.name.strip()
                        user_global_name = user.global_name.strip() if user.global_name else None
                        user_mention = user.mention.strip()
                        user_display_name = user.display_name.strip()
                        
                        # Создаем список всех возможных имен пользователя
                        possible_names = [name for name in [user_name, user_global_name, user_mention, user_display_name] if name]
                        
                        # Проверяем, есть ли хотя бы одно из имен пользователя в списке
                        if any(name in names for name in possible_names):
                            op_amount = dist['xpAmount']
                            total_op += op_amount
                            user_events.append({
                                'title': event['title'],
                                'op': op_amount
                            })

                if not user_events:
                    await interaction.followup.send(f"❌ No OP history found for {user.mention}", ephemeral=True)
                    return

                # Создаем embed с историей
                embed = discord.Embed(
                    title=f"📊 OP History for {user.display_name}",
                    color=discord.Color.blue()
                )
                
                # Добавляем аватар пользователя
                avatar_url = user.display_avatar.url if user.display_avatar else user.default_avatar.url
                embed.set_thumbnail(url=avatar_url)
                
                embed.add_field(
                    name="Total OP Earned",
                    value=f"`{total_op} OP`",
                    inline=False
                )

                # Добавляем маленький отступ
                embed.add_field(
                    name="⠀",
                    value="⠀",
                    inline=False
                )
                
                # Добавляем последние события (максимум 10)
                recent_events = sorted(user_events, key=lambda x: x['op'], reverse=True)[:10]
                recent_events_text = "\n".join([
                    f"✅ **{event['title']}** ➜ `{event['op']} OP`"
                    for event in recent_events
                ])
                
                embed.add_field(
                    name="🎮 Recent Events",
                    value=recent_events_text or "No recent events",
                    inline=False
                )

                await interaction.followup.send(embed=embed, ephemeral=True)

    except Exception as e:
        logger.error(f"Error in history command: {str(e)}")
        await interaction.followup.send(f"❌ An error occurred: {str(e)}", ephemeral=True)

class WhitelistCommands(app_commands.Group):
    def __init__(self):
        super().__init__(name="whitelist", description="Whitelist management commands")

    def get_base_url(self):
        return os.getenv('SAHARA_API_URL', 'http://localhost:3000')

    def get_headers(self):
        return {
            'Content-Type': 'application/json',
            'x-api-key': os.getenv('ENGAGE_API_TOKEN')
        }

    def is_authorized(self, user_id: int) -> bool:
        authorized_users = os.getenv('AUTHORIZED_USERS', '').split(',')
        return str(user_id) in authorized_users

    async def check_authorized(self, interaction: discord.Interaction) -> bool:
        if not self.is_authorized(interaction.user.id):
            await interaction.response.send_message(
                "❌ You are not authorized to use this command!",
                ephemeral=True
            )
            return False
        return True

    @app_commands.command(name="add", description="Add a user to the whitelist")
    async def add(self, interaction: discord.Interaction, user: discord.Member):
        if not await self.check_authorized(interaction):
            return

        try:
            await interaction.response.defer(ephemeral=True)

            url = f"{self.get_base_url()}/whitelist/{user.id}/{os.getenv('WHITELIST_SECRET')}"
            headers = self.get_headers()

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('success'):
                            action = "added to" if data.get('created') else "already in"
                            await interaction.followup.send(f"✅ User {user.mention} {action} whitelist")
                        else:
                            await interaction.followup.send(f"❌ Failed to add user to whitelist: {data.get('error')}")
                    else:
                        await interaction.followup.send(f"❌ Error adding user to whitelist. Status: {response.status}")
        except Exception as e:
            logger.error(f"Error in whitelist add: {str(e)}")
            await interaction.followup.send(f"❌ Error: {str(e)}")

    @app_commands.command(name="remove", description="Remove a user from the whitelist")
    async def remove(self, interaction: discord.Interaction, user: discord.Member):
        if not await self.check_authorized(interaction):
            return

        try:
            await interaction.response.defer(ephemeral=True)

            url = f"{self.get_base_url()}/whitelist/{user.id}/{os.getenv('WHITELIST_SECRET')}"
            headers = self.get_headers()

            async with aiohttp.ClientSession() as session:
                async with session.delete(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('success'):
                            await interaction.followup.send(f"✅ User {user.mention} removed from whitelist")
                        else:
                            await interaction.followup.send(f"❌ Failed to remove user from whitelist: {data.get('error')}")
                    else:
                        await interaction.followup.send(f"❌ Error removing user from whitelist. Status: {response.status}")
        except Exception as e:
            logger.error(f"Error in whitelist remove: {str(e)}")
            await interaction.followup.send(f"❌ Error: {str(e)}")

    @app_commands.command(name="list", description="Show list of users in the whitelist")
    async def list(self, interaction: discord.Interaction):
        if not await self.check_authorized(interaction):
            return

        try:
            await interaction.response.defer(ephemeral=True)

            url = f"{self.get_base_url()}/whitelist-list/{os.getenv('WHITELIST_SECRET')}"
            headers = self.get_headers()

            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('users'):
                            # Create list of users with their mentions
                            user_list = []
                            for user_id in data['users']:
                                member = interaction.guild.get_member(int(user_id))
                                if member:
                                    user_list.append(f"{member.mention} ({member.name})")
                                else:
                                    user_list.append(f"ID: {user_id} (not in server)")

                            # Create embed for nice display
                            embed = discord.Embed(
                                title="Whitelist Users",
                                description=f"Total users: {len(data['users'])}",
                                color=discord.Color.blue()
                            )

                            # Split list into chunks if it's too long
                            chunks = [user_list[i:i + 10] for i in range(0, len(user_list), 10)]
                            for i, chunk in enumerate(chunks, 1):
                                embed.add_field(
                                    name=f"Users",
                                    value="\n".join(chunk) or "No users",
                                    inline=False
                                )

                            await interaction.followup.send(embed=embed)
                        else:
                            await interaction.followup.send("No users in whitelist")
                    else:
                        await interaction.followup.send(f"❌ Error fetching whitelist. Status: {response.status}")
        except Exception as e:
            logger.error(f"Error in whitelist list: {str(e)}")
            await interaction.followup.send(f"❌ Error: {str(e)}")

    # Error handler for all commands
    async def cog_command_error(self, interaction: discord.Interaction, error):
        if isinstance(error, app_commands.errors.MissingPermissions):
            await interaction.response.send_message(
                "❌ You don't have permission to use this command!",
                ephemeral=True
            )
        else:
            await interaction.response.send_message(
                f"❌ An error occurred: {str(error)}",
                ephemeral=True
            )

if __name__ == "__main__":
    client.run(DISCORD_TOKEN)