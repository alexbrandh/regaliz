export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      ar_views: {
        Row: {
          id: string
          postcard_id: string
          viewed_at: string
          user_agent: string | null
          ip_address: string | null
        }
        Insert: {
          id?: string
          postcard_id: string
          viewed_at?: string
          user_agent?: string | null
          ip_address?: string | null
        }
        Update: {
          id?: string
          postcard_id?: string
          viewed_at?: string
          user_agent?: string | null
          ip_address?: string | null
        }
        Relationships: []
      }
      postcards: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          image_url: string
          video_url: string
          nft_descriptors: Json | null
          processing_status: 'processing' | 'ready' | 'error' | 'needs_better_image'
          error_message: string | null
          is_public: boolean
          created_at: string
          updated_at: string
          is_activated: boolean
          activated_at: string | null
          fulfillment_type: 'digital' | 'physical' | null
          shopify_order_id: string | null
          shopify_order_number: string | null
          shipping_address: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          image_url: string
          video_url: string
          nft_descriptors?: Json | null
          processing_status?: 'processing' | 'ready' | 'error' | 'needs_better_image'
          error_message?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
          is_activated?: boolean
          activated_at?: string | null
          fulfillment_type?: 'digital' | 'physical' | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          shipping_address?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          image_url?: string
          video_url?: string
          nft_descriptors?: Json | null
          processing_status?: 'processing' | 'ready' | 'error' | 'needs_better_image'
          error_message?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
          is_activated?: boolean
          activated_at?: string | null
          fulfillment_type?: 'digital' | 'physical' | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          shipping_address?: Json | null
        }
        Relationships: []
      }
      shopify_webhook_events: {
        Row: {
          id: string
          shopify_event_id: string
          topic: string
          payload: Json
          processed_at: string | null
          error: string | null
          received_at: string
        }
        Insert: {
          id?: string
          shopify_event_id: string
          topic: string
          payload: Json
          processed_at?: string | null
          error?: string | null
          received_at?: string
        }
        Update: {
          id?: string
          shopify_event_id?: string
          topic?: string
          payload?: Json
          processed_at?: string | null
          error?: string | null
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      processing_status: 'processing' | 'ready' | 'error' | 'needs_better_image'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Postcard = Database['public']['Tables']['postcards']['Row']
export type PostcardInsert = Database['public']['Tables']['postcards']['Insert']
export type PostcardUpdate = Database['public']['Tables']['postcards']['Update']
export type ProcessingStatus = Database['public']['Enums']['processing_status']

export interface ShippingAddress {
  first_name: string
  last_name: string
  address1: string
  address2?: string | null
  city: string
  province?: string | null
  country: string
  zip: string
  phone?: string | null
}