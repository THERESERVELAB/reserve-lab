import type { FeatureKey, SubscriptionTier, UserPersona } from "@/lib/saas-config";
import type { RetentionMilestoneKey } from "@/lib/retention-config";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled" | "grace_period";
export type CommunityRole = "owner" | "coach" | "moderator" | "member";
export type ChannelVisibility = "public" | "core" | "pro" | "elite" | "private";
export type AcquisitionSource =
  | "free-ai-body-assessment"
  | "free-training-split-generator"
  | "free-bloodwork-upload-preview"
  | "free-12-week-physique-projection"
  | "free-physique-scan"
  | "free-bloodwork-review"
  | "training-split-generator"
  | "waitlist"
  | "referral"
  | "affiliate";

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type TimestampedInsert = {
  created_at?: string;
  updated_at?: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          email: string | null;
          display_name: string | null;
          persona: UserPersona;
          current_tier: SubscriptionTier;
          onboarding_status: string;
          onboarding_state: Json;
          preferences: Json;
          referral_code: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          email?: string | null;
          display_name?: string | null;
          persona?: UserPersona;
          current_tier?: SubscriptionTier;
          onboarding_status?: string;
          onboarding_state?: Json;
          preferences?: Json;
          referral_code?: string | null;
        } & TimestampedInsert
      >;
      athlete_profiles: Table<
        {
          user_id: string;
          status: "active" | "paused" | "closed";
          created_at: string;
          updated_at: string;
        },
        {
          user_id: string;
          status?: "active" | "paused" | "closed";
        } & TimestampedInsert
      >;
      coach_profiles: Table<
        {
          user_id: string;
          display_name: string | null;
          business_name: string | null;
          verification_status: "pending" | "active" | "suspended";
          created_at: string;
          updated_at: string;
        },
        {
          user_id: string;
          display_name?: string | null;
          business_name?: string | null;
          verification_status?: "pending" | "active" | "suspended";
        } & TimestampedInsert
      >;
      coach_client_relationships: Table<
        {
          id: string;
          coach_id: string;
          athlete_id: string;
          status: "pending" | "active" | "revoked" | "declined";
          permissions: Json;
          requested_by: string;
          approved_by_athlete_at: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          coach_id: string;
          athlete_id: string;
          status?: "pending" | "active" | "revoked" | "declined";
          permissions?: Json;
          requested_by: string;
          approved_by_athlete_at?: string | null;
          revoked_at?: string | null;
        } & TimestampedInsert
      >;
      onboarding_profiles: Table<
        {
          id: string;
          user_id: string;
          goal: string | null;
          training_age: string | null;
          primary_focus: string | null;
          enhanced_tracking_enabled: boolean;
          state: Json;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          goal?: string | null;
          training_age?: string | null;
          primary_focus?: string | null;
          enhanced_tracking_enabled?: boolean;
          state?: Json;
          completed_at?: string | null;
        } & TimestampedInsert
      >;
      user_preferences: Table<
        {
          user_id: string;
          units: string;
          theme: string;
          date_format: string;
          notifications_enabled: boolean;
          dashboard_density: string;
          data_retention: string;
          created_at: string;
          updated_at: string;
        },
        {
          user_id: string;
          units?: string;
          theme?: string;
          date_format?: string;
          notifications_enabled?: boolean;
          dashboard_density?: string;
          data_retention?: string;
        } & TimestampedInsert
      >;
      subscriptions: Table<
        {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          tier: SubscriptionTier;
          status: SubscriptionStatus;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          tier: SubscriptionTier;
          status: SubscriptionStatus;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
        } & TimestampedInsert
      >;
      user_entitlements: Table<
        {
          id: string;
          user_id: string;
          feature_key: FeatureKey;
          source: string;
          expires_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          feature_key: FeatureKey;
          source?: string;
          expires_at?: string | null;
          created_at?: string;
        }
      >;
      engagement_events: Table<
        {
          id: string;
          user_id: string | null;
          event_name: string;
          feature_key: FeatureKey | null;
          session_id: string | null;
          metadata: Json;
          created_at: string;
        },
        {
          id?: string;
          user_id?: string | null;
          event_name: string;
          feature_key?: FeatureKey | null;
          session_id?: string | null;
          metadata?: Json;
          created_at?: string;
        }
      >;
      retention_snapshots: Table<
        {
          id: string;
          user_id: string;
          current_streak: number;
          best_streak: number;
          weekly_readiness_score: number;
          adherence_score: number;
          activation_score: number;
          churn_risk_score: number;
          completed_milestones: RetentionMilestoneKey[];
          last_check_in_at: string | null;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          current_streak?: number;
          best_streak?: number;
          weekly_readiness_score?: number;
          adherence_score?: number;
          activation_score?: number;
          churn_risk_score?: number;
          completed_milestones?: RetentionMilestoneKey[];
          last_check_in_at?: string | null;
          updated_at?: string;
        }
      >;
      body_metrics: Table<
        {
          id: string;
          user_id: string;
          metric_key: string;
          value: number;
          unit: string;
          measured_at: string;
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          metric_key: string;
          value: number;
          unit?: string;
          measured_at?: string;
          notes?: string | null;
          created_at?: string;
        }
      >;
      muscle_scores: Table<
        {
          id: string;
          user_id: string;
          muscle_group: string;
          score: number;
          previous_score: number | null;
          trend: string;
          observed_at: string;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          muscle_group: string;
          score: number;
          previous_score?: number | null;
          trend?: string;
          observed_at?: string;
          created_at?: string;
        }
      >;
      weak_points: Table<
        {
          id: string;
          user_id: string;
          muscle_group: string;
          severity: string;
          notes: string | null;
          detected_at: string;
          resolved_at: string | null;
        },
        {
          id?: string;
          user_id: string;
          muscle_group: string;
          severity?: string;
          notes?: string | null;
          detected_at?: string;
          resolved_at?: string | null;
        }
      >;
      progress_photos: Table<
        {
          id: string;
          user_id: string;
          storage_path: string;
          angle: string;
          lighting_notes: string | null;
          captured_at: string;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          storage_path: string;
          angle: string;
          lighting_notes?: string | null;
          captured_at?: string;
          created_at?: string;
        }
      >;
      transformation_snapshots: Table<
        {
          id: string;
          user_id: string;
          title: string;
          summary: string | null;
          snapshot_date: string;
          metrics: Json;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          title: string;
          summary?: string | null;
          snapshot_date?: string;
          metrics?: Json;
          created_at?: string;
        }
      >;
      digital_twin_snapshots: Table<
        {
          id: string;
          user_id: string;
          physique_archetype: string | null;
          goal_state: string | null;
          weak_points: string[];
          muscle_scores: Json;
          body_metrics: Json;
          symmetry_score: number | null;
          projection: Json;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          physique_archetype?: string | null;
          goal_state?: string | null;
          weak_points?: string[];
          muscle_scores?: Json;
          body_metrics?: Json;
          symmetry_score?: number | null;
          projection?: Json;
          created_at?: string;
        }
      >;
      training_sessions: Table<
        {
          id: string;
          user_id: string;
          mesocycle_id: string | null;
          training_style: string;
          focus: string | null;
          readiness_score: number | null;
          perceived_effort: number | null;
          notes: string | null;
          performed_at: string;
          split_day: number | null;
          cardio_minutes: number | null;
          sauna_minutes: number | null;
          total_volume_lbs: number | null;
          total_sets_completed: number | null;
          status: string;
          source: string;
          exercise_logs: Json;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          mesocycle_id?: string | null;
          training_style: string;
          focus?: string | null;
          readiness_score?: number | null;
          perceived_effort?: number | null;
          notes?: string | null;
          performed_at?: string;
          split_day?: number | null;
          cardio_minutes?: number | null;
          sauna_minutes?: number | null;
          total_volume_lbs?: number | null;
          total_sets_completed?: number | null;
          status?: string;
          source?: string;
          exercise_logs?: Json;
          created_at?: string;
        }
      >;
      exercise_logs: Table<
        {
          id: string;
          session_id: string;
          user_id: string;
          exercise_name: string;
          muscle_groups: string[];
          sets: Json;
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          session_id: string;
          user_id: string;
          exercise_name: string;
          muscle_groups?: string[];
          sets?: Json;
          notes?: string | null;
          created_at?: string;
        }
      >;
      mesocycles: Table<
        {
          id: string;
          user_id: string;
          name: string;
          style: string;
          goal: string;
          starts_on: string;
          ends_on: string;
          emphasis_muscles: string[];
          deload_planned: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          name: string;
          style: string;
          goal: string;
          starts_on: string;
          ends_on: string;
          emphasis_muscles?: string[];
          deload_planned?: boolean;
          metadata?: Json;
        } & TimestampedInsert
      >;
      nutrition_logs: Table<
        {
          id: string;
          user_id: string;
          calories: number | null;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          adherence_score: number | null;
          day_type: string;
          meals: Json;
          water_liters: number | null;
          notes: string | null;
          source: string;
          logged_at: string;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          calories?: number | null;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          adherence_score?: number | null;
          day_type?: string;
          meals?: Json;
          water_liters?: number | null;
          notes?: string | null;
          source?: string;
          logged_at?: string;
          created_at?: string;
        }
      >;
      member_state: Table<
        {
          user_id: string;
          state: Json;
          schema_version: number;
          created_at: string;
          updated_at: string;
        },
        {
          user_id: string;
          state: Json;
          schema_version?: number;
        } & TimestampedInsert
      >;
      // 30-day version history kept by the member_state guard trigger
      // (supabase/migrations/0008_member_state_guard.sql). Written only by the
      // trigger; a member may read their own rows under RLS.
      member_state_history: Table<
        {
          id: number;
          user_id: string;
          state: Json;
          schema_version: number | null;
          replaced_at: string;
        },
        {
          user_id: string;
          state: Json;
          schema_version?: number | null;
        }
      >;
      recovery_logs: Table<
        {
          id: string;
          user_id: string;
          logged_at: string;
          hrv: number | null;
          resting_hr: number | null;
          sleep_hours: number | null;
          sleep_quality: string | null;
          readiness_score: number | null;
          mood_score: number | null;
          joint_feedback: string | null;
          cns_feeling: string | null;
          notes: string | null;
          source: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          logged_at?: string;
          hrv?: number | null;
          resting_hr?: number | null;
          sleep_hours?: number | null;
          sleep_quality?: string | null;
          readiness_score?: number | null;
          mood_score?: number | null;
          joint_feedback?: string | null;
          cns_feeling?: string | null;
          notes?: string | null;
          source?: string;
        } & TimestampedInsert
      >;
      bloodwork_logs: Table<
        {
          id: string;
          user_id: string;
          marker: string;
          value: number | null;
          unit: string | null;
          category: string;
          observed_at: string;
          source: string | null;
          file_path: string | null;
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          marker: string;
          value?: number | null;
          unit?: string | null;
          category: string;
          observed_at?: string;
          source?: string | null;
          file_path?: string | null;
          notes?: string | null;
          created_at?: string;
        }
      >;
      supplement_logs: Table<
        {
          id: string;
          user_id: string;
          name: string;
          category: string | null;
          logged_at: string;
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          name: string;
          category?: string | null;
          logged_at?: string;
          notes?: string | null;
          created_at?: string;
        }
      >;
      upgrade_intents: Table<
        {
          id: string;
          user_id: string | null;
          feature_key: FeatureKey;
          required_tier: SubscriptionTier;
          source: string;
          metadata: Json;
          created_at: string;
        },
        {
          id?: string;
          user_id?: string | null;
          feature_key: FeatureKey;
          required_tier: SubscriptionTier;
          source: string;
          metadata?: Json;
          created_at?: string;
        }
      >;
      community_channels: Table<
        {
          id: string;
          slug: string;
          name: string;
          description: string;
          visibility: ChannelVisibility;
          required_tier: SubscriptionTier;
          kind: string;
          pinned_message_id: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          slug: string;
          name: string;
          description?: string;
          visibility?: ChannelVisibility;
          required_tier?: SubscriptionTier;
          kind?: string;
          pinned_message_id?: string | null;
        } & TimestampedInsert
      >;
      community_memberships: Table<
        {
          id: string;
          channel_id: string | null;
          user_id: string;
          role: CommunityRole;
          member_rank: string;
          joined_at: string;
          last_seen_at: string | null;
        },
        {
          id?: string;
          channel_id?: string | null;
          user_id: string;
          role?: CommunityRole;
          member_rank?: string;
          joined_at?: string;
          last_seen_at?: string | null;
        }
      >;
      community_messages: Table<
        {
          id: string;
          channel_id: string;
          user_id: string;
          parent_id: string | null;
          body: string;
          is_pinned: boolean;
          check_in_type: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        },
        {
          id?: string;
          channel_id: string;
          user_id: string;
          parent_id?: string | null;
          body: string;
          is_pinned?: boolean;
          check_in_type?: string | null;
          metadata?: Json;
          deleted_at?: string | null;
        } & TimestampedInsert
      >;
      community_reactions: Table<
        {
          id: string;
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        },
        {
          id?: string;
          message_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        }
      >;
      community_presence: Table<
        {
          id: string;
          channel_id: string | null;
          user_id: string;
          status: string;
          last_seen_at: string;
          metadata: Json;
        },
        {
          id?: string;
          channel_id?: string | null;
          user_id: string;
          status?: string;
          last_seen_at?: string;
          metadata?: Json;
        }
      >;
      intelligence_outputs: Table<
        {
          id: string;
          user_id: string;
          output_type: string;
          model: string;
          input_hash: string | null;
          output: Json;
          safety_notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          output_type: string;
          model: string;
          input_hash?: string | null;
          output: Json;
          safety_notes?: string | null;
          created_at?: string;
        }
      >;
      training_prescriptions: Table<
        {
          id: string;
          user_id: string;
          plan_id: string;
          title: string;
          split_name: string;
          split_day: number | null;
          focus: string | null;
          plan: Json;
          safety_notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          plan_id: string;
          title: string;
          split_name?: string;
          split_day?: number | null;
          focus?: string | null;
          plan: Json;
          safety_notes?: string | null;
          created_at?: string;
        }
      >;
      todays_commands: Table<
        {
          id: string;
          user_id: string;
          command_date: string;
          command: Json;
          safety_notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          command_date?: string;
          command: Json;
          safety_notes?: string | null;
          created_at?: string;
        }
      >;
      active_sessions: Table<
        {
          id: string;
          user_id: string;
          session_id: string;
          plan_id: string;
          title: string;
          status: string;
          session: Json;
          started_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          session_id: string;
          plan_id: string;
          title: string;
          status?: string;
          session: Json;
          started_at?: string;
          completed_at?: string | null;
        } & TimestampedInsert
      >;
      session_sets: Table<
        {
          id: string;
          user_id: string;
          session_id: string;
          exercise_id: string;
          set_number: number;
          load: number | null;
          reps: number;
          rir: number | null;
          metadata: Json;
          completed_at: string;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          session_id: string;
          exercise_id: string;
          set_number: number;
          load?: number | null;
          reps: number;
          rir?: number | null;
          metadata?: Json;
          completed_at?: string;
          created_at?: string;
        }
      >;
      session_swaps: Table<
        {
          id: string;
          user_id: string;
          session_id: string;
          exercise_id: string;
          original_exercise: string;
          replacement_exercise: string;
          reason: string | null;
          preserves_stimulus: string | null;
          swapped_at: string;
          metadata: Json;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          session_id: string;
          exercise_id: string;
          original_exercise: string;
          replacement_exercise: string;
          reason?: string | null;
          preserves_stimulus?: string | null;
          swapped_at?: string;
          metadata?: Json;
          created_at?: string;
        }
      >;
      progression_snapshots: Table<
        {
          id: string;
          user_id: string;
          snapshot_date: string;
          snapshot: Json;
          safety_notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          snapshot_date?: string;
          snapshot: Json;
          safety_notes?: string | null;
          created_at?: string;
        }
      >;
      digital_athlete_snapshots: Table<
        {
          id: string;
          user_id: string;
          snapshot_date: string;
          snapshot: Json;
          safety_notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          snapshot_date?: string;
          snapshot: Json;
          safety_notes?: string | null;
          created_at?: string;
        }
      >;
      physique_checkins: Table<
        {
          id: string;
          user_id: string;
          check_in_date: string;
          photos: Json;
          critique: Json;
          safety_notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          check_in_date?: string;
          photos?: Json;
          critique?: Json;
          safety_notes?: string | null;
          created_at?: string;
        }
      >;
      nutrition_commands: Table<
        {
          id: string;
          user_id: string;
          command_date: string;
          command: Json;
          safety_notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          command_date?: string;
          command: Json;
          safety_notes?: string | null;
          created_at?: string;
        }
      >;
      recovery_commands: Table<
        {
          id: string;
          user_id: string;
          command_date: string;
          command: Json;
          safety_notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          command_date?: string;
          command: Json;
          safety_notes?: string | null;
          created_at?: string;
        }
      >;
      ai_outputs: Table<
        {
          id: string;
          user_id: string;
          output_type: string;
          model: string;
          input_hash: string | null;
          output: Json;
          safety_notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          output_type: string;
          model: string;
          input_hash?: string | null;
          output: Json;
          safety_notes?: string | null;
          created_at?: string;
        }
      >;
      ai_analysis_outputs: Table<
        {
          id: string;
          user_id: string;
          analysis_type: string;
          model: string;
          input_hash: string | null;
          output: Json;
          safety_notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          user_id: string;
          analysis_type: string;
          model: string;
          input_hash?: string | null;
          output: Json;
          safety_notes?: string | null;
          created_at?: string;
        }
      >;
      lead_captures: Table<
        {
          id: string;
          email: string;
          source: AcquisitionSource;
          referral_code: string | null;
          affiliate_code: string | null;
          metadata: Json;
          created_at: string;
        },
        {
          id?: string;
          email: string;
          source: AcquisitionSource;
          referral_code?: string | null;
          affiliate_code?: string | null;
          metadata?: Json;
          created_at?: string;
        }
      >;
      referrals: Table<
        {
          id: string;
          referrer_user_id: string | null;
          referred_email: string;
          code: string;
          converted_user_id: string | null;
          created_at: string;
        },
        {
          id?: string;
          referrer_user_id?: string | null;
          referred_email: string;
          code: string;
          converted_user_id?: string | null;
          created_at?: string;
        }
      >;
      affiliate_attributions: Table<
        {
          id: string;
          affiliate_code: string;
          lead_id: string | null;
          user_id: string | null;
          metadata: Json;
          created_at: string;
        },
        {
          id?: string;
          affiliate_code: string;
          lead_id?: string | null;
          user_id?: string | null;
          metadata?: Json;
          created_at?: string;
        }
      >;
      connected_health_sources: Table<
        {
          id: string;
          user_id: string;
          provider: string;
          status: string;
          granted_scopes: string[];
          vendor_user_id: string | null;
          vendor_display_name: string | null;
          last_successful_sync_at: string | null;
          last_sync_error: string | null;
          last_cursor: string | null;
          source_priority: Json;
          synthetic: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          provider: string;
          status?: string;
          granted_scopes?: string[];
          vendor_user_id?: string | null;
          vendor_display_name?: string | null;
          last_successful_sync_at?: string | null;
          last_sync_error?: string | null;
          last_cursor?: string | null;
          source_priority?: Json;
          synthetic?: boolean;
        } & TimestampedInsert
      >;
      /** Sealed OAuth tokens. Reachable only with the service role — RLS denies members outright. */
      connected_health_credentials: Table<
        {
          source_id: string;
          user_id: string;
          access_token_sealed: string;
          refresh_token_sealed: string | null;
          access_token_expires_at: string;
          created_at: string;
          updated_at: string;
        },
        {
          source_id: string;
          user_id: string;
          access_token_sealed: string;
          refresh_token_sealed?: string | null;
          access_token_expires_at: string;
        } & TimestampedInsert
      >;
      connected_health_observations: Table<
        {
          id: string;
          user_id: string;
          source_id: string | null;
          provider: string;
          source_device: string | null;
          original_record_id: string | null;
          dedupe_key: string;
          category: string;
          measurement_type: string;
          value_numeric: number | null;
          value_text: string | null;
          unit: string | null;
          observed_at: string;
          imported_at: string;
          revised_at: string | null;
          permission_scope: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          source_id?: string | null;
          provider: string;
          source_device?: string | null;
          original_record_id?: string | null;
          dedupe_key: string;
          category: string;
          measurement_type: string;
          value_numeric?: number | null;
          value_text?: string | null;
          unit?: string | null;
          observed_at: string;
          imported_at?: string;
          revised_at?: string | null;
          permission_scope: string;
          metadata?: Json;
        } & TimestampedInsert
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
