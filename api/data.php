<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';



const DATA_TABLES = [
    'players' => ['read' => 'players.view', 'write' => 'players.manage', 'columns' => ['id', 'name', 'phone', 'email', 'bibs_taken_count', 'start_date', 'archived_at', 'skill_level'], 'order' => ['id', 'name', 'email', 'start_date', 'created_at', 'updated_at']],
    'games' => ['read' => 'games.view', 'write' => 'games.manage', 'columns' => ['id', 'game_date', 'start_time', 'end_time', 'location'], 'order' => ['id', 'game_date', 'start_time', 'location', 'created_at', 'updated_at']],
    'game_players' => ['read' => 'attendance.view', 'write' => 'attendance.manage', 'columns' => ['id', 'game_id', 'player_id', 'guest_name', 'playing', 'paid', 'took_bibs'], 'order' => ['id', 'game_id', 'player_id', 'created_at', 'updated_at']],
    'payments' => ['read' => 'payments.view', 'write' => 'payments.manage', 'columns' => ['id', 'player_id', 'game_id', 'payment_type', 'paid'], 'order' => ['id', 'player_id', 'game_id', 'created_at']],
    'finance_seasons' => ['read' => 'payments.view', 'write' => 'payments.manage', 'columns' => ['id', 'name', 'starts_on', 'ends_on', 'season_ticket_amount', 'pay_per_game_amount'], 'order' => ['id', 'name', 'starts_on', 'ends_on', 'created_at', 'updated_at']],
    'finance_season_tickets' => ['read' => 'payments.view', 'write' => 'payments.manage', 'columns' => ['id', 'season_id', 'player_id', 'amount', 'paid', 'paid_on'], 'order' => ['id', 'season_id', 'player_id', 'paid_on', 'created_at', 'updated_at']],
    'finance_expenses' => ['read' => 'payments.view', 'write' => 'payments.manage', 'columns' => ['id', 'season_id', 'due_date', 'description', 'category', 'amount', 'paid', 'paid_on'], 'order' => ['id', 'season_id', 'due_date', 'description', 'created_at']],
    'team_captain_history' => ['read' => 'games.view', 'write' => 'games.manage', 'columns' => ['id', 'game_id', 'team_name', 'player_id'], 'order' => ['id', 'game_id', 'team_name', 'created_at']],
];

require __DIR__ . '/data-handler.php';
