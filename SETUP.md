# Wordle Enhanced - Setup Instructions

## Database Setup (One-time setup)

You need to run the SQL schema to create the database tables in Supabase.

### Steps:

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project: **wordle-enhanced**
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Open the file `supabase-schema.sql` in this repository
6. Copy ALL the SQL code from that file
7. Paste it into the Supabase SQL Editor
8. Click **Run** (or press Ctrl+Enter)

You should see a success message indicating that the tables and functions were created.

### What this creates:

- **users** table: Stores usernames
- **game_stats** table: Stores individual game results
- **user_aggregates** table: Stores calculated statistics
- Automatic triggers to update stats when games are played
- Row Level Security (RLS) policies for data protection

## Running the Application

1. Open `index.html` in a web browser
2. You'll see a login/signup modal on first visit
3. Create a username (no password needed - this is a simple implementation)
4. Start playing!

## Features

- **User Authentication**: Simple username-based authentication
- **Stats Tracking**: All game results are saved to Supabase
- **Advanced Statistics**:
  - Win rate and streaks
  - Guess distribution chart
  - Game history
  - Average guesses per win
- **LocalStorage Backup**: Stats are saved locally as backup
- **Migration**: Existing localStorage stats are automatically migrated on first login

## Testing

To test the application:

1. Create a new user account
2. Play a few games (win some, lose some)
3. Click "View Stats" to see your statistics
4. Check the guess distribution chart
5. View your game history

## Troubleshooting

### "Failed to save stats to Supabase"
- Check that you ran the SQL schema in Supabase
- Verify your Supabase project is active
- Check browser console for detailed error messages

### Stats not showing
- Make sure you're logged in
- Verify the database tables were created correctly
- Check Supabase dashboard > Table Editor to see if data is being saved

### Authentication errors
- Username must be at least 3 characters
- Usernames are unique - try a different one if taken
- Check browser console for errors

## Development Notes

- The app uses ES6 modules (`type="module"` in script tags)
- Supabase credentials are in `supabase-client.js`
- Stats are saved both to localStorage (backup) and Supabase (primary)
- The app works entirely client-side (no backend server needed)
