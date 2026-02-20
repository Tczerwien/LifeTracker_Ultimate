use chrono::Datelike;
use rand::prelude::*;
use rand::rngs::StdRng;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::engine::scoring::{compute_scores, ScoringInput, ScoringOutput};
use crate::AppState;

use super::daily_log::{
    build_habit_values, build_vice_values, load_active_habit_configs, load_scoring_config,
    DailyLogInput,
};
use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct TestDataSummary {
    pub daily_logs: usize,
    pub journals: usize,
    pub study_sessions: usize,
    pub applications: usize,
    pub relapse_entries: usize,
    pub urge_entries: usize,
    pub weekly_reviews: usize,
}

// ---------------------------------------------------------------------------
// Constants: Placeholder text pools
// ---------------------------------------------------------------------------

const HIGHLIGHTS: &[&str] = &[
    "Finished a major assignment ahead of schedule",
    "Had a productive study session at the library",
    "Went for a long run and felt great afterward",
    "Connected with an old friend over coffee",
    "Made progress on personal coding project",
    "Attended an interesting guest lecture",
    "Cooked a healthy meal from scratch",
    "Helped a classmate with a tough problem",
    "Woke up early and had a calm morning routine",
    "Got positive feedback on recent work",
    "Discovered a new book that I'm really enjoying",
    "Had a breakthrough on a difficult problem set",
    "Organized my workspace and felt more focused",
    "Practiced meditation and felt centered all day",
    "Applied to several promising job openings",
    "Led a productive group study session",
    "Exercised despite not feeling motivated",
    "Journaled about goals and felt clarity",
    "Maintained streak despite a tough day",
    "Learned a new programming concept",
];

const GRATITUDE: &[&str] = &[
    "Grateful for good health",
    "Thankful for supportive friends",
    "Appreciative of access to education",
    "Grateful for a quiet place to study",
    "Thankful for a warm meal",
    "Grateful for progress, even if small",
    "Appreciative of the sunrise this morning",
    "Thankful for a restful night of sleep",
    "Grateful for my family's support",
    "Appreciative of music that lifts my mood",
    "Thankful for another chance to improve",
    "Grateful for free online learning resources",
    "Appreciative of nature and fresh air",
    "Thankful for moments of peace",
    "Grateful for the ability to learn from mistakes",
];

const REFLECTIONS: &[&str] = &[
    "Today was a solid day. Stayed on track with most habits.",
    "Struggled a bit with focus but recovered in the afternoon.",
    "Felt tired but pushed through. Proud of the effort.",
    "Good balance between study and rest today.",
    "Need to work on waking up earlier consistently.",
    "Phone use was higher than I'd like. Setting limits tomorrow.",
    "Felt motivated and productive. Want to sustain this energy.",
    "Had some temptations but stayed strong. Recovery is a journey.",
    "Mixed day — some wins, some areas to improve.",
    "Great energy levels today. Sleep routine is paying off.",
    "Focused well during study session. The Pomodoro technique helps.",
    "Spent too much time on social media. Need better boundaries.",
    "Feeling more disciplined than last month. Progress is real.",
    "Quiet day. Sometimes rest is productive too.",
    "Challenged myself and grew. That's what matters.",
];

const GOALS: &[&str] = &[
    "Wake up by 8am and start with meditation",
    "Complete the problem set before noon",
    "Spend at least 2 hours on personal project",
    "Go to the gym in the morning",
    "Keep phone use under 60 minutes",
    "Read for 30 minutes before bed",
    "Apply to at least 2 new positions",
    "Attend office hours for extra help",
    "Cook a healthy dinner instead of ordering",
    "Practice the breathing exercise when stressed",
];

const COMPANIES: &[&str] = &[
    "Google", "Microsoft", "Amazon", "Apple", "Meta",
    "Netflix", "Spotify", "Stripe", "Airbnb", "Dropbox",
    "Slack", "GitHub", "Shopify", "Datadog", "Cloudflare",
    "Notion", "Figma", "Vercel", "Supabase", "Linear",
    "Palantir", "Snowflake", "HashiCorp", "Twilio", "Square",
    "Coinbase", "Robinhood", "Plaid", "Databricks", "MongoDB",
];

const ROLES: &[&str] = &[
    "Software Engineer", "Frontend Developer", "Backend Developer",
    "Full Stack Developer", "Data Analyst", "DevOps Engineer",
    "Machine Learning Engineer", "Product Manager", "QA Engineer",
    "Site Reliability Engineer",
];

const SUBJECTS: &[&str] = &[
    "Math", "CS", "Physics", "English", "History",
    "Biology", "Chemistry", "Economics", "Psychology", "Other",
];

const STUDY_TYPES: &[&str] = &[
    "Lecture", "Problem Set", "Reading", "Lab",
    "Group Study", "Review", "Office Hours", "Other",
];

const STUDY_LOCATIONS: &[&str] = &["Library", "Home", "Classroom", "Cafe", "Other"];

const APP_SOURCES: &[&str] = &[
    "LinkedIn", "Indeed", "Company Website", "Referral", "Career Fair", "Other",
];

const RELAPSE_DURATIONS: &[&str] = &[
    "< 5 min", "5-15 min", "15-30 min", "30-60 min", "> 60 min",
];

const RELAPSE_TRIGGERS: &[&str] = &[
    "Boredom", "Stress", "Loneliness", "Anxiety",
    "Late Night", "Social Media", "Argument", "Other",
];

const RELAPSE_LOCATIONS: &[&str] = &[
    "Bedroom", "Bathroom", "Living Room", "Other",
];

const RELAPSE_DEVICES: &[&str] = &["Phone", "Laptop", "Desktop", "Tablet", "Other"];

const RELAPSE_ACTIVITIES: &[&str] = &[
    "Scrolling", "Studying", "Lying in Bed", "Watching TV", "Nothing", "Other",
];

const EMOTIONAL_STATES: &[&str] = &[
    "Stressed", "Bored", "Lonely", "Anxious",
    "Sad", "Tired", "Frustrated", "Neutral",
];

const RESISTANCE_TECHNIQUES: &[&str] = &[
    "None", "Cold Shower", "Exercise", "Meditation",
    "Called a Friend", "Went Outside", "Deep Breathing", "Other",
];

const URGE_TECHNIQUES: &[&str] = &[
    "Cold Shower", "Exercise", "Meditation", "Deep Breathing",
    "Distraction", "Called a Friend", "Went Outside", "Journaling",
];

const URGE_DURATIONS: &[&str] = &[
    "< 1 min", "1-5 min", "5-15 min", "15-30 min", "> 30 min",
];

const URGE_DID_PASS: &[&str] = &[
    "Yes - completely",
    "Yes - eventually",
    "No (but I resisted anyway)",
];

const WEEKLY_WINS: &[&str] = &[
    "Maintained workout streak all week",
    "Completed all assignments on time",
    "Applied to multiple jobs this week",
    "Improved my daily score average",
    "Read every day this week",
    "Kept phone use consistently low",
    "Had great social interactions",
    "Stayed clean all week",
    "Woke up on time every day",
    "Made significant progress on personal project",
];

const WEEKLY_CHALLENGES: &[&str] = &[
    "Struggled with motivation mid-week",
    "Phone use crept up on some days",
    "Missed a couple gym sessions",
    "Had a difficult day emotionally",
    "Felt overwhelmed with coursework",
    "Sleep schedule got disrupted",
    "Hard to stay focused during study",
    "Dealt with unexpected stress",
    "Skipped meditation a few times",
    "Procrastinated on job applications",
];

const WEEKLY_GOALS: &[&str] = &[
    "Focus on consistent sleep schedule",
    "Complete all assignments ahead of deadline",
    "Apply to at least 5 positions",
    "Exercise 5 days minimum",
    "Keep phone under 90 min daily average",
    "Read for 30 min every day",
    "Meditate every morning",
    "Improve weekly score by 5%",
    "Cook more meals at home",
    "Reach out to one new contact for networking",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Pick a random element from a slice.
fn pick<'a, R: Rng>(rng: &mut R, items: &'a [&'a str]) -> &'a str {
    items[rng.gen_range(0..items.len())]
}

/// Return true with the given probability [0.0, 1.0].
fn chance<R: Rng>(rng: &mut R, probability: f64) -> bool {
    rng.gen::<f64>() < probability
}

/// Weighted random pick from (value, weight) pairs.
fn weighted_pick<'a, R: Rng>(rng: &mut R, options: &[(&'a str, f64)]) -> &'a str {
    let total: f64 = options.iter().map(|(_, w)| w).sum();
    let mut r = rng.gen::<f64>() * total;
    for &(val, weight) in options {
        r -= weight;
        if r <= 0.0 {
            return val;
        }
    }
    options.last().unwrap().0
}

/// Generate a date string N days after start_date (2025-02-20).
fn date_for_day(day_index: i32) -> String {
    let base = chrono::NaiveDate::from_ymd_opt(2025, 2, 20).unwrap();
    let date = base + chrono::Duration::days(day_index as i64);
    date.format("%Y-%m-%d").to_string()
}

/// Get day of week (0=Mon, 6=Sun) for a day index.
fn day_of_week(day_index: i32) -> u32 {
    let base = chrono::NaiveDate::from_ymd_opt(2025, 2, 20).unwrap();
    let date = base + chrono::Duration::days(day_index as i64);
    date.weekday().num_days_from_monday()
}

/// Linear interpolation from start_val to end_val based on progress [0.0, 1.0].
fn lerp(start_val: f64, end_val: f64, progress: f64) -> f64 {
    start_val + (end_val - start_val) * progress.clamp(0.0, 1.0)
}

/// Compute the Monday of the week containing the given date.
fn week_start_for_date(date_str: &str) -> String {
    let date = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d").unwrap();
    let weekday = date.weekday().num_days_from_monday();
    let monday = date - chrono::Duration::days(weekday as i64);
    monday.format("%Y-%m-%d").to_string()
}

/// Compute the Sunday of the week containing the given date.
fn week_end_for_date(date_str: &str) -> String {
    let date = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d").unwrap();
    let weekday = date.weekday().num_days_from_monday();
    let sunday = date + chrono::Duration::days((6 - weekday) as i64);
    sunday.format("%Y-%m-%d").to_string()
}

/// Get ISO week number for a date string.
fn iso_week_number(date_str: &str) -> i64 {
    let date = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d").unwrap();
    date.iso_week().week() as i64
}

// ---------------------------------------------------------------------------
// Core Generator (operates on a raw Connection for testability)
// ---------------------------------------------------------------------------

pub(crate) fn generate_test_data_impl(conn: &Connection) -> CommandResult<TestDataSummary> {
    // Check for existing data to avoid duplicates
    let existing_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM daily_log", [], |row| row.get(0))
        .map_err(CommandError::from)?;
    if existing_count > 0 {
        return Err(CommandError::from(
            "Database already contains daily log data. Clear the database before generating test data.",
        ));
    }

    let mut rng = StdRng::seed_from_u64(42); // Deterministic for reproducibility
    let total_days: i32 = 365;
    let now = chrono::Utc::now().to_rfc3339();

    // Load scoring infrastructure
    let habit_configs = load_active_habit_configs(conn)?;
    let scoring_config = load_scoring_config(conn)?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| CommandError::from(format!("Transaction error: {}", e)))?;

    // -----------------------------------------------------------------------
    // 1. Daily Logs (365 entries)
    // -----------------------------------------------------------------------
    let mut previous_streak: i32 = -1; // Day 1 convention
    let mut daily_log_count: usize = 0;

    for day in 0..total_days {
        let date = date_for_day(day);
        let progress = day as f64 / total_days as f64; // 0.0 → 1.0 over the year
        let dow = day_of_week(day); // 0=Mon, 6=Sun
        let is_weekday = dow < 5;

        // Habit completion probability improves over the year
        let base_completion = lerp(0.55, 0.85, progress);

        // Generate good habit values
        let schoolwork = if is_weekday && chance(&mut rng, base_completion + 0.1) { 1 } else { 0 };
        let personal_project = if chance(&mut rng, base_completion - 0.1) { 1 } else { 0 };
        let classes = if is_weekday && chance(&mut rng, base_completion + 0.15) { 1 } else { 0 };
        let job_search = if is_weekday && chance(&mut rng, base_completion - 0.15) { 1 } else { 0 };
        let gym = if chance(&mut rng, base_completion) { 1 } else { 0 };
        let sleep_7_9h = if chance(&mut rng, base_completion + 0.05) { 1 } else { 0 };
        let wake_8am = if chance(&mut rng, base_completion - 0.05) { 1 } else { 0 };
        let supplements = if chance(&mut rng, base_completion + 0.1) { 1 } else { 0 };
        let stretching = if chance(&mut rng, base_completion - 0.1) { 1 } else { 0 };
        let meditate = if chance(&mut rng, base_completion - 0.15) { 1 } else { 0 };
        let read_val = if chance(&mut rng, base_completion - 0.05) { 1 } else { 0 };

        // Dropdown habits with weighted random
        let meal_quality = if chance(&mut rng, base_completion) {
            weighted_pick(&mut rng, &[
                ("Poor", 0.1), ("Okay", 0.25), ("Good", 0.4), ("Great", 0.25),
            ]).to_string()
        } else {
            "None".to_string()
        };

        let social = if chance(&mut rng, if is_weekday { 0.3 } else { 0.6 }) {
            weighted_pick(&mut rng, &[
                ("Brief/Text", 0.4), ("Casual Hangout", 0.35), ("Meaningful Connection", 0.25),
            ]).to_string()
        } else {
            "None".to_string()
        };

        // Vice trigger probability decreases over the year (recovery simulation)
        let vice_rate = lerp(0.30, 0.10, progress);

        let porn = if chance(&mut rng, vice_rate * 0.5) { rng.gen_range(1..=3) } else { 0 };
        let masturbate = if chance(&mut rng, vice_rate * 0.6) { 1 } else { 0 };
        let weed = if chance(&mut rng, vice_rate * 0.3) { 1 } else { 0 };
        let skip_class = if is_weekday && chance(&mut rng, vice_rate * 0.3) { 1 } else { 0 };
        let binged_content = if chance(&mut rng, vice_rate * 0.5) { 1 } else { 0 };
        let gaming_1h = if chance(&mut rng, vice_rate * 0.4) { 1 } else { 0 };
        let past_12am = if chance(&mut rng, vice_rate * 0.6) { 1 } else { 0 };
        let late_wake = if chance(&mut rng, vice_rate * 0.4) { 1 } else { 0 };

        // Phone use: 30–300 minutes with natural variation, trending down
        let base_phone = lerp(150.0, 80.0, progress);
        let phone_use = (base_phone + rng.gen_range(-40.0..60.0)).max(20.0).min(400.0) as i64;

        let entry = DailyLogInput {
            date: date.clone(),
            schoolwork, personal_project, classes, job_search,
            gym, sleep_7_9h, wake_8am, supplements, meal_quality, stretching,
            meditate, read: read_val, social,
            porn, masturbate, weed, skip_class, binged_content, gaming_1h,
            past_12am, late_wake, phone_use,
        };

        // Compute scores
        let habit_values = build_habit_values(&entry, &habit_configs);
        let vice_values = build_vice_values(&entry, &habit_configs);
        let scoring_input = ScoringInput {
            habit_values,
            vice_values,
            phone_minutes: phone_use as f64,
            previous_streak,
            config: scoring_config.clone(),
        };
        let scores: ScoringOutput = compute_scores(&scoring_input);

        // Track streak for next day
        previous_streak = scores.streak;

        // Generate timestamp for this day (around 9pm of the date)
        let logged_at = format!("{}T21:00:00Z", date);

        tx.execute(
            "INSERT INTO daily_log (\
             date, schoolwork, personal_project, classes, job_search, \
             gym, sleep_7_9h, wake_8am, supplements, meal_quality, stretching, \
             meditate, \"read\", social, \
             porn, masturbate, weed, skip_class, binged_content, gaming_1h, \
             past_12am, late_wake, phone_use, \
             positive_score, vice_penalty, base_score, streak, final_score, \
             logged_at, last_modified\
             ) VALUES (\
             ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, \
             ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, \
             ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30\
             )",
            params![
                date,
                entry.schoolwork, entry.personal_project, entry.classes, entry.job_search,
                entry.gym, entry.sleep_7_9h, entry.wake_8am, entry.supplements,
                entry.meal_quality, entry.stretching,
                entry.meditate, entry.read, entry.social,
                entry.porn, entry.masturbate, entry.weed, entry.skip_class,
                entry.binged_content, entry.gaming_1h, entry.past_12am,
                entry.late_wake, entry.phone_use,
                scores.positive_score, scores.vice_penalty, scores.base_score,
                scores.streak, scores.final_score,
                logged_at, &now,
            ],
        )?;
        daily_log_count += 1;
    }

    // -----------------------------------------------------------------------
    // 2. Journal Entries (~80% fill rate)
    // -----------------------------------------------------------------------
    let mut journal_count: usize = 0;
    for day in 0..total_days {
        if !chance(&mut rng, 0.80) {
            continue;
        }
        let date = date_for_day(day);
        let mood = rng.gen_range(2..=5);
        let energy = rng.gen_range(2..=5);
        let logged_at = format!("{}T21:30:00Z", date);

        tx.execute(
            "INSERT INTO journal (\
             date, mood, energy, highlight, gratitude, \
             reflection, tomorrow_goal, logged_at, last_modified\
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                date, mood, energy,
                pick(&mut rng, HIGHLIGHTS),
                pick(&mut rng, GRATITUDE),
                pick(&mut rng, REFLECTIONS),
                pick(&mut rng, GOALS),
                logged_at, &now,
            ],
        )?;
        journal_count += 1;
    }

    // -----------------------------------------------------------------------
    // 3. Study Sessions (~150 total, ~3 per week)
    // -----------------------------------------------------------------------
    let mut study_count: usize = 0;
    for day in 0..total_days {
        // ~3 sessions per week = ~42% chance per day, but cluster on weekdays
        let session_chance = if day_of_week(day) < 5 { 0.50 } else { 0.25 };
        if !chance(&mut rng, session_chance) {
            continue;
        }
        let date = date_for_day(day);
        let duration = rng.gen_range(30..=180);
        let focus = rng.gen_range(2..=5);
        let start_hour = rng.gen_range(8..=17);
        let start_time = format!("{:02}:00", start_hour);
        let end_minutes = start_hour * 60 + duration;
        let end_time = format!("{:02}:{:02}", (end_minutes / 60).min(23), end_minutes % 60);
        let logged_at = format!("{}T{}:00Z", date, end_time);

        tx.execute(
            "INSERT INTO study_session (\
             date, subject, study_type, start_time, end_time, \
             duration_minutes, focus_score, location, topic, resources, notes, \
             logged_at, last_modified\
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '', '', '', ?9, ?10)",
            params![
                date,
                pick(&mut rng, SUBJECTS),
                pick(&mut rng, STUDY_TYPES),
                start_time, end_time,
                duration, focus,
                pick(&mut rng, STUDY_LOCATIONS),
                logged_at, &now,
            ],
        )?;
        study_count += 1;
    }

    // -----------------------------------------------------------------------
    // 4. Applications (~50 total, spread across the year)
    // -----------------------------------------------------------------------
    let mut app_count: usize = 0;
    let statuses = [
        ("applied", 20),
        ("phone_screen", 10),
        ("interview", 8),
        ("technical_screen", 5),
        ("offer", 3),
        ("rejected", 2),
        ("no_response", 2),
    ];

    // Create a shuffled list of application days
    let mut app_days: Vec<i32> = (0..total_days).filter(|_| chance(&mut rng, 0.15)).take(50).collect();
    if app_days.len() < 50 {
        // Fill up to target
        while app_days.len() < 50 && app_days.len() < total_days as usize {
            let d = rng.gen_range(0..total_days);
            if !app_days.contains(&d) {
                app_days.push(d);
            }
        }
    }
    app_days.sort();
    app_days.truncate(50);

    let mut status_idx = 0;
    let mut status_remaining = statuses[0].1;

    for (i, &day) in app_days.iter().enumerate() {
        let date = date_for_day(day);
        let company = COMPANIES[i % COMPANIES.len()];
        let role = pick(&mut rng, ROLES);
        let source = pick(&mut rng, APP_SOURCES);
        let archived = i >= 40; // Last 10 are archived
        let logged_at = format!("{}T12:00:00Z", date);

        // Determine status for this application
        let status = statuses[status_idx].0;
        status_remaining -= 1;
        if status_remaining == 0 && status_idx + 1 < statuses.len() {
            status_idx += 1;
            status_remaining = statuses[status_idx].1;
        }

        tx.execute(
            "INSERT INTO application (\
             date_applied, company, role, source, current_status, \
             url, notes, follow_up_date, salary, contact_name, contact_email, \
             login_username, login_password, archived, logged_at, last_modified\
             ) VALUES (?1, ?2, ?3, ?4, ?5, '', '', NULL, '', '', '', '', '', ?6, ?7, ?8)",
            params![
                date, company, role, source, status,
                archived as i64, logged_at, &now,
            ],
        )?;

        let app_id = tx.last_insert_rowid();

        // Add initial "applied" status change
        tx.execute(
            "INSERT INTO status_change (application_id, status, date, notes, created_at) \
             VALUES (?1, 'applied', ?2, '', ?3)",
            params![app_id, date, &now],
        )?;

        // Add intermediate status changes for non-"applied" apps
        if status != "applied" {
            let status_chain: Vec<&str> = match status {
                "phone_screen" => vec!["phone_screen"],
                "interview" => vec!["phone_screen", "interview"],
                "technical_screen" => vec!["phone_screen", "interview", "technical_screen"],
                "offer" => vec!["phone_screen", "interview", "technical_screen", "offer"],
                "rejected" => vec!["phone_screen", "rejected"],
                "no_response" => vec!["no_response"],
                _ => vec![],
            };
            for (j, &s) in status_chain.iter().enumerate() {
                let change_day = day + (j as i32 + 1) * 7; // Each status ~1 week apart
                if change_day < total_days {
                    let change_date = date_for_day(change_day);
                    tx.execute(
                        "INSERT INTO status_change (application_id, status, date, notes, created_at) \
                         VALUES (?1, ?2, ?3, '', ?4)",
                        params![app_id, s, change_date, &now],
                    )?;
                }
            }
        }

        app_count += 1;
    }

    // -----------------------------------------------------------------------
    // 5. Recovery Entries
    // -----------------------------------------------------------------------

    // 5a. Urge entries (~60 total, decreasing over the year)
    let mut urge_count: usize = 0;
    let urge_targets = [20, 17, 13, 10]; // Per quarter
    for quarter in 0..4_usize {
        let q_start = (quarter as i32) * 91;
        let q_end = ((quarter as i32) + 1) * 91;
        let target = urge_targets[quarter];
        for _ in 0..target {
            let day = rng.gen_range(q_start..q_end.min(total_days));
            let date = date_for_day(day);
            let hour = rng.gen_range(18..=23);
            let minute = rng.gen_range(0..60);
            let time = format!("{:02}:{:02}", hour, minute);
            let created_at = format!("{}T{}:00Z", date, time);

            tx.execute(
                "INSERT INTO urge_entry (\
                 date, time, intensity, technique, effectiveness, \
                 duration, did_pass, trigger, notes, created_at, last_modified\
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '', ?9, ?10)",
                params![
                    date, time,
                    rng.gen_range(3..=8),
                    pick(&mut rng, URGE_TECHNIQUES),
                    rng.gen_range(2..=5),
                    pick(&mut rng, URGE_DURATIONS),
                    pick(&mut rng, URGE_DID_PASS),
                    pick(&mut rng, RELAPSE_TRIGGERS),
                    created_at, &now,
                ],
            )?;
            urge_count += 1;
        }
    }

    // 5b. Relapse entries (~30 total, slight decrease over the year)
    let mut relapse_count: usize = 0;
    let relapse_targets = [9, 8, 7, 6]; // Per quarter
    for quarter in 0..4_usize {
        let q_start = (quarter as i32) * 91;
        let q_end = ((quarter as i32) + 1) * 91;
        let target = relapse_targets[quarter];
        for _ in 0..target {
            let day = rng.gen_range(q_start..q_end.min(total_days));
            let date = date_for_day(day);
            let hour = rng.gen_range(21..=23);
            let minute = rng.gen_range(0..60);
            let time = format!("{:02}:{:02}", hour, minute);
            let created_at = format!("{}T{}:00Z", date, time);

            tx.execute(
                "INSERT INTO relapse_entry (\
                 date, time, duration, trigger, location, device, \
                 activity_before, emotional_state, resistance_technique, \
                 urge_intensity, notes, created_at, last_modified\
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, '', ?11, ?12)",
                params![
                    date, time,
                    pick(&mut rng, RELAPSE_DURATIONS),
                    pick(&mut rng, RELAPSE_TRIGGERS),
                    pick(&mut rng, RELAPSE_LOCATIONS),
                    pick(&mut rng, RELAPSE_DEVICES),
                    pick(&mut rng, RELAPSE_ACTIVITIES),
                    pick(&mut rng, EMOTIONAL_STATES),
                    pick(&mut rng, RESISTANCE_TECHNIQUES),
                    rng.gen_range(4..=9),
                    created_at, &now,
                ],
            )?;
            relapse_count += 1;
        }
    }

    // -----------------------------------------------------------------------
    // 6. Weekly Reviews (~50 out of 52 weeks)
    // -----------------------------------------------------------------------
    let mut review_count: usize = 0;
    let mut seen_weeks: std::collections::HashSet<String> = std::collections::HashSet::new();

    for day in (0..total_days).step_by(7) {
        let date = date_for_day(day);
        let ws = week_start_for_date(&date);

        if seen_weeks.contains(&ws) {
            continue;
        }
        // Skip ~2 weeks randomly
        if !chance(&mut rng, 0.96) {
            seen_weeks.insert(ws);
            continue;
        }
        seen_weeks.insert(ws.clone());

        let we = week_end_for_date(&date);
        let week_num = iso_week_number(&ws);

        // Compute actual stats from the data we just inserted
        let (avg_score, days_tracked, best_day, worst_day): (Option<f64>, i64, Option<f64>, Option<f64>) = tx
            .query_row(
                "SELECT AVG(final_score), COUNT(*), MAX(final_score), MIN(final_score) \
                 FROM daily_log WHERE date >= ?1 AND date <= ?2 AND final_score IS NOT NULL",
                params![ws, we],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(CommandError::from)?;

        let habits_completed: i64 = tx
            .query_row(
                "SELECT COALESCE(SUM(\
                 schoolwork + personal_project + classes + job_search + \
                 gym + sleep_7_9h + wake_8am + supplements + stretching + \
                 meditate + \"read\" + \
                 CASE WHEN meal_quality != 'None' THEN 1 ELSE 0 END + \
                 CASE WHEN social != 'None' THEN 1 ELSE 0 END\
                 ), 0) FROM daily_log WHERE date >= ?1 AND date <= ?2",
                params![ws, we],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?;

        let study_hours: f64 = tx
            .query_row(
                "SELECT COALESCE(SUM(duration_minutes), 0) / 60.0 \
                 FROM study_session WHERE date >= ?1 AND date <= ?2",
                params![ws, we],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?;

        let applications_sent: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM application WHERE date_applied >= ?1 AND date_applied <= ?2",
                params![ws, we],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?;

        let relapses: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM relapse_entry WHERE date >= ?1 AND date <= ?2",
                params![ws, we],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?;

        let urges_resisted: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM urge_entry \
                 WHERE date >= ?1 AND date <= ?2 AND did_pass LIKE 'Yes%'",
                params![ws, we],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?;

        let streak_at_end: Option<i32> = tx
            .query_row(
                "SELECT streak FROM daily_log WHERE date <= ?1 AND streak IS NOT NULL \
                 ORDER BY date DESC LIMIT 1",
                params![we],
                |row| row.get(0),
            )
            .optional()
            .map_err(CommandError::from)?
            .flatten();

        let snapshot_date = chrono::Utc::now().to_rfc3339();
        let logged_at = format!("{}T22:00:00Z", we);

        tx.execute(
            "INSERT INTO weekly_review (\
             week_start, week_end, week_number, \
             avg_score, days_tracked, best_day_score, worst_day_score, \
             habits_completed, study_hours, applications_sent, \
             relapses, urges_resisted, streak_at_end, \
             biggest_win, biggest_challenge, next_week_goal, reflection, \
             snapshot_date, score_snapshot, \
             logged_at, last_modified\
             ) VALUES (\
             ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, \
             ?11, ?12, ?13, ?14, ?15, ?16, '', ?17, NULL, ?18, ?19\
             )",
            params![
                ws, we, week_num,
                avg_score, days_tracked, best_day, worst_day,
                habits_completed, study_hours, applications_sent,
                relapses, urges_resisted, streak_at_end.unwrap_or(0) as i64,
                pick(&mut rng, WEEKLY_WINS),
                pick(&mut rng, WEEKLY_CHALLENGES),
                pick(&mut rng, WEEKLY_GOALS),
                snapshot_date,
                logged_at, &now,
            ],
        )?;
        review_count += 1;
    }

    // -----------------------------------------------------------------------
    // Commit
    // -----------------------------------------------------------------------
    tx.commit()?;

    Ok(TestDataSummary {
        daily_logs: daily_log_count,
        journals: journal_count,
        study_sessions: study_count,
        applications: app_count,
        relapse_entries: relapse_count,
        urge_entries: urge_count,
        weekly_reviews: review_count,
    })
}

// ---------------------------------------------------------------------------
// Tauri Command
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn generate_test_data(
    state: tauri::State<'_, AppState>,
) -> CommandResult<TestDataSummary> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    generate_test_data_impl(&db)
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::analytics::{
        get_correlation_data_impl, get_day_of_week_averages_impl,
        get_habit_completion_rates_impl, get_recovery_frequency_impl, get_score_trend_impl,
        get_study_summary_impl, get_vice_frequency_impl,
    };
    use crate::db::migrations::run_migrations;

    fn setup_test_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        run_migrations(&mut conn).expect("Migration should succeed");
        conn
    }

    #[test]
    fn test_generate_test_data_counts() {
        let conn = setup_test_db();
        let summary = generate_test_data_impl(&conn).unwrap();

        assert_eq!(summary.daily_logs, 365, "Should generate exactly 365 daily logs");
        assert!(summary.journals >= 250 && summary.journals <= 330,
            "Journals: expected ~292 (80% of 365), got {}", summary.journals);
        assert!(summary.study_sessions >= 100 && summary.study_sessions <= 200,
            "Study sessions: expected ~150, got {}", summary.study_sessions);
        assert_eq!(summary.applications, 50, "Should generate 50 applications");
        assert_eq!(summary.relapse_entries, 30, "Should generate 30 relapses");
        assert_eq!(summary.urge_entries, 60, "Should generate 60 urges");
        assert!(summary.weekly_reviews >= 45 && summary.weekly_reviews <= 53,
            "Weekly reviews: expected ~50, got {}", summary.weekly_reviews);
    }

    #[test]
    fn test_generate_test_data_rejects_duplicates() {
        let conn = setup_test_db();
        generate_test_data_impl(&conn).unwrap();

        // Second call should fail
        let result = generate_test_data_impl(&conn);
        assert!(result.is_err(), "Should reject duplicate generation");
    }

    #[test]
    fn test_generated_data_scores_valid() {
        let conn = setup_test_db();
        generate_test_data_impl(&conn).unwrap();

        // Verify all scores are in valid range
        let invalid_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM daily_log WHERE \
                 final_score < 0.0 OR final_score > 1.0 OR \
                 base_score < 0.0 OR base_score > 1.0 OR \
                 positive_score < 0.0 OR positive_score > 1.0 OR \
                 vice_penalty < 0.0 OR vice_penalty > 1.0",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(invalid_count, 0, "All scores should be in [0, 1]");

        // Verify score distribution is realistic (not all 0 or all 1)
        let (avg, min, max): (f64, f64, f64) = conn
            .query_row(
                "SELECT AVG(final_score), MIN(final_score), MAX(final_score) \
                 FROM daily_log WHERE final_score IS NOT NULL",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert!(avg > 0.3 && avg < 0.9,
            "Average score {:.3} should be between 0.3 and 0.9", avg);
        assert!(min < 0.3, "Min score {:.3} should be below 0.3", min);
        assert!(max > 0.7, "Max score {:.3} should be above 0.7", max);
    }

    #[test]
    fn test_generated_data_streaks_valid() {
        let conn = setup_test_db();
        generate_test_data_impl(&conn).unwrap();

        // Verify streaks are non-negative
        let invalid_streaks: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM daily_log WHERE streak < 0",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(invalid_streaks, 0, "All streaks should be >= 0");

        // Verify some streaks exist (not all 0)
        let max_streak: i32 = conn
            .query_row(
                "SELECT MAX(streak) FROM daily_log WHERE streak IS NOT NULL",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(max_streak > 3, "Should have some streaks > 3, got max {}", max_streak);
    }

    #[test]
    fn test_generated_journals_valid() {
        let conn = setup_test_db();
        generate_test_data_impl(&conn).unwrap();

        // Verify mood and energy ranges
        let invalid: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM journal WHERE mood < 1 OR mood > 5 OR energy < 1 OR energy > 5",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(invalid, 0, "All mood/energy should be 1-5");
    }

    #[test]
    fn test_generated_applications_have_status_history() {
        let conn = setup_test_db();
        generate_test_data_impl(&conn).unwrap();

        // Every application should have at least one status_change (the initial "applied")
        let apps_without_history: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM application a \
                 WHERE NOT EXISTS (SELECT 1 FROM status_change sc WHERE sc.application_id = a.id)",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(apps_without_history, 0, "All applications should have status history");
    }

    // -----------------------------------------------------------------------
    // Performance Benchmarks
    // -----------------------------------------------------------------------

    #[test]
    fn bench_analytics_queries_365_days() {
        let conn = setup_test_db();
        generate_test_data_impl(&conn).unwrap();

        let start = "2025-02-20";
        let end = "2026-02-19";

        // Benchmark each analytics query
        let queries: Vec<(&str, Box<dyn Fn() -> Result<(), CommandError>>)> = vec![
            ("get_score_trend", Box::new(|| {
                get_score_trend_impl(&conn, start, end)?;
                Ok(())
            })),
            ("get_habit_completion_rates", Box::new(|| {
                get_habit_completion_rates_impl(&conn, start, end)?;
                Ok(())
            })),
            ("get_vice_frequency", Box::new(|| {
                get_vice_frequency_impl(&conn, start, end)?;
                Ok(())
            })),
            ("get_day_of_week_averages", Box::new(|| {
                get_day_of_week_averages_impl(&conn, start, end)?;
                Ok(())
            })),
            ("get_correlation_data", Box::new(|| {
                get_correlation_data_impl(&conn, start, end)?;
                Ok(())
            })),
            ("get_study_summary", Box::new(|| {
                get_study_summary_impl(&conn, start, end)?;
                Ok(())
            })),
            ("get_recovery_frequency", Box::new(|| {
                get_recovery_frequency_impl(&conn, start, end)?;
                Ok(())
            })),
        ];

        let mut all_passed = true;
        for (name, query_fn) in &queries {
            let timer = std::time::Instant::now();
            query_fn().expect(&format!("{} should not error", name));
            let elapsed = timer.elapsed();
            let ms = elapsed.as_millis();

            println!("  {} — {}ms (target: <200ms)", name, ms);

            if ms > 200 {
                eprintln!("  ⚠ {} exceeded 200ms target: {}ms", name, ms);
                all_passed = false;
            }
        }

        assert!(all_passed, "All analytics queries should complete within 200ms on 365-day dataset");
    }

    #[test]
    fn bench_correlation_engine_365_days() {
        let conn = setup_test_db();
        generate_test_data_impl(&conn).unwrap();

        // Fetch all daily logs for the correlation engine
        let start = "2025-02-20";
        let end = "2026-02-19";
        let logs = get_correlation_data_impl(&conn, start, end).unwrap();
        assert_eq!(logs.len(), 365);

        // The correlation engine runs in TypeScript, but we can benchmark
        // the data fetch time here (the expensive part from Rust's perspective)
        let timer = std::time::Instant::now();
        let _logs_again = get_correlation_data_impl(&conn, start, end).unwrap();
        let elapsed = timer.elapsed();
        println!("  correlation data fetch — {}ms (target: <200ms)", elapsed.as_millis());
        assert!(elapsed.as_millis() < 200, "Correlation data fetch should be < 200ms");
    }
}
