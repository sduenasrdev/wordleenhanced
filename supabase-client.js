// Supabase Client Configuration
const SUPABASE_URL = 'https://plbpktymupdjpfwusaqn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYnBrdHltdXBkanBmd3VzYXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNDMxMzcsImV4cCI6MjA4MDgxOTEzN30.9XxPemPcSfS0-id-djMGwJyme6CI_cBtNj51Uo-mSrw';

// Initialize Supabase client (will be available after script loads)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Current user state
let currentUser = null;

// Auth functions
export async function registerUser(username) {
  try {
    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (existingUser) {
      throw new Error('Username already taken');
    }

    // Create new user
    const { data, error } = await supabase
      .from('users')
      .insert([{ username }])
      .select()
      .single();

    if (error) throw error;

    // Save to localStorage
    localStorage.setItem('wordleUser', JSON.stringify(data));
    currentUser = data;

    return { success: true, user: data };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: error.message };
  }
}

export async function loginUser(username) {
  try {
    // Find user by username
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      throw new Error('Username not found');
    }

    // Save to localStorage
    localStorage.setItem('wordleUser', JSON.stringify(data));
    currentUser = data;

    return { success: true, user: data };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

export function logoutUser() {
  localStorage.removeItem('wordleUser');
  currentUser = null;
}

export function getCurrentUser() {
  if (!currentUser) {
    const stored = localStorage.getItem('wordleUser');
    if (stored) {
      currentUser = JSON.parse(stored);
    }
  }
  return currentUser;
}

export function isLoggedIn() {
  return getCurrentUser() !== null;
}

// Database functions for game stats
export async function saveGameStats(word, won, guessesUsed) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not logged in');
  }

  try {
    const { data, error } = await supabase
      .from('game_stats')
      .insert([{
        user_id: user.id,
        word: word,
        won: won,
        guesses_used: guessesUsed
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error saving game stats:', error);
    return { success: false, error: error.message };
  }
}

export async function getUserAggregates() {
  const user = getCurrentUser();
  if (!user) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('user_aggregates')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    // Return default stats if no record exists
    return data || {
      total_games: 0,
      total_wins: 0,
      total_losses: 0,
      current_streak: 0,
      max_streak: 0
    };
  } catch (error) {
    console.error('Error fetching aggregates:', error);
    return {
      total_games: 0,
      total_wins: 0,
      total_losses: 0,
      current_streak: 0,
      max_streak: 0
    };
  }
}

export async function getGameHistory(limit = 10) {
  const user = getCurrentUser();
  if (!user) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('game_stats')
      .select('*')
      .eq('user_id', user.id)
      .order('game_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching game history:', error);
    return [];
  }
}

export async function migrateLocalStatsToSupabase() {
  const user = getCurrentUser();
  if (!user) {
    return { success: false, error: 'No user logged in' };
  }

  try {
    // Get localStorage stats
    const localStats = JSON.parse(localStorage.getItem("wordleStats"));
    if (!localStats || localStats.games === 0) {
      return { success: true, message: 'No local stats to migrate' };
    }

    // Create aggregate record with local stats
    const { error } = await supabase
      .from('user_aggregates')
      .insert([{
        user_id: user.id,
        total_games: localStats.games,
        total_wins: localStats.wins,
        total_losses: localStats.losses,
        current_streak: localStats.streak,
        max_streak: localStats.maxStreak
      }])
      .select()
      .single();

    if (error && error.code !== '23505') { // 23505 = duplicate key
      throw error;
    }

    // Mark migration as complete
    localStorage.setItem('statsMigrated', 'true');

    return { success: true, message: 'Stats migrated successfully' };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error: error.message };
  }
}

export async function getGuessDistribution() {
  const user = getCurrentUser();
  if (!user) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('game_stats')
      .select('guesses_used')
      .eq('user_id', user.id)
      .eq('won', true);

    if (error) throw error;

    // Count distribution
    const distribution = [0, 0, 0, 0, 0, 0]; // 1-6 guesses
    data.forEach(game => {
      if (game.guesses_used >= 1 && game.guesses_used <= 6) {
        distribution[game.guesses_used - 1]++;
      }
    });

    return distribution;
  } catch (error) {
    console.error('Error fetching guess distribution:', error);
    return [0, 0, 0, 0, 0, 0];
  }
}

export async function getLeaderboard(limit = 10) {
  try {
    // Get all users with their aggregates
    const { data, error } = await supabase
      .from('user_aggregates')
      .select(`
        user_id,
        total_games,
        total_wins,
        total_losses,
        current_streak,
        max_streak,
        users!inner(username)
      `)
      .gte('total_games', 5) // Only show users with at least 5 games
      .order('total_wins', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // Calculate win rate and format data
    const leaderboard = data
      .map(entry => {
        const winRate = entry.total_games > 0
          ? (entry.total_wins / entry.total_games) * 100
          : 0;

        return {
          username: entry.users.username,
          total_games: entry.total_games,
          total_wins: entry.total_wins,
          win_rate: winRate,
          max_streak: entry.max_streak,
          current_streak: entry.current_streak
        };
      })
      .sort((a, b) => {
        // Sort by win rate first, then by total games as tiebreaker
        if (Math.abs(b.win_rate - a.win_rate) > 0.01) {
          return b.win_rate - a.win_rate;
        }
        return b.total_games - a.total_games;
      })
      .slice(0, limit);

    return leaderboard;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}
