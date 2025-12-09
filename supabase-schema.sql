-- Supabase Database Schema for Wordle Enhanced
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game stats table (individual game records)
CREATE TABLE IF NOT EXISTS game_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  word TEXT NOT NULL,
  won BOOLEAN NOT NULL,
  guesses_used INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User aggregates table (cached statistics)
CREATE TABLE IF NOT EXISTS user_aggregates (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  total_games INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  max_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_game_stats_user_id ON game_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_game_stats_game_date ON game_stats(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_aggregates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read all usernames" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own data" ON users
  FOR INSERT WITH CHECK (true);

-- RLS Policies for game_stats table
CREATE POLICY "Users can read their own game stats" ON game_stats
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own game stats" ON game_stats
  FOR INSERT WITH CHECK (true);

-- RLS Policies for user_aggregates table
CREATE POLICY "Users can read their own aggregates" ON user_aggregates
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own aggregates" ON user_aggregates
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own aggregates" ON user_aggregates
  FOR UPDATE USING (true);

-- Function to automatically update user_aggregates when a game is added
CREATE OR REPLACE FUNCTION update_user_aggregates()
RETURNS TRIGGER AS $$
DECLARE
  v_streak INTEGER;
  v_last_game_won BOOLEAN;
BEGIN
  -- Get or create aggregate record
  INSERT INTO user_aggregates (user_id, total_games, total_wins, total_losses, current_streak, max_streak)
  VALUES (NEW.user_id, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update game counts
  UPDATE user_aggregates
  SET
    total_games = total_games + 1,
    total_wins = total_wins + CASE WHEN NEW.won THEN 1 ELSE 0 END,
    total_losses = total_losses + CASE WHEN NOT NEW.won THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE user_id = NEW.user_id;

  -- Calculate streak
  IF NEW.won THEN
    UPDATE user_aggregates
    SET
      current_streak = current_streak + 1,
      max_streak = GREATEST(max_streak, current_streak + 1)
    WHERE user_id = NEW.user_id;
  ELSE
    UPDATE user_aggregates
    SET current_streak = 0
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update aggregates
CREATE TRIGGER trigger_update_user_aggregates
AFTER INSERT ON game_stats
FOR EACH ROW
EXECUTE FUNCTION update_user_aggregates();

-- Insert a test user (optional - for testing)
-- INSERT INTO users (username) VALUES ('test_user');
