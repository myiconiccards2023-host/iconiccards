import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

let supabase = null;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'order-now-assets';

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  console.log(`[Supabase Storage] Configured for bucket: ${bucketName}`);
}

// Local uploads directory fallback
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const storage = {
  isSupabase: isSupabaseConfigured,

  /**
   * Uploads file buffer to Supabase Storage Bucket or local public/uploads directory.
   * Returns a publicly accessible URL.
   */
  async uploadFile(file, folder = 'uploads') {
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .upload(filename, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });

        if (!error && data) {
          const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filename);

          return publicUrlData.publicUrl;
        }

        console.warn('[Supabase Storage Notice]:', error?.message || 'Bucket error. Falling back to local storage.');
      } catch (uploadErr) {
        console.warn('[Supabase Storage Exception]:', uploadErr.message);
      }
    }

    // Local storage fallback
    const subDir = path.join(uploadsDir, folder);
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }

    const localFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    const filePath = path.join(subDir, localFileName);
    fs.writeFileSync(filePath, file.buffer);

    return `/uploads/${folder}/${localFileName}`;
  }
};
