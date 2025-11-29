import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wgaitjmljbqslmlhknkf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnYWl0am1samJxc2xtbGhrbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjkzOTIsImV4cCI6MjA3OTk0NTM5Mn0.N8QY81LremQgsY_RrB7JjA9x9IyCh3hyjt3XvBn-T2g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);