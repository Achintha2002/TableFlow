import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const backendDir = path.resolve(process.cwd(), '../backend');
    const files = fs.readdirSync(backendDir);
    const deleted = [];
    for (const f of files) {
      if (f.startsWith('{"authUsers') || f.includes('authUsers')) {
        fs.unlinkSync(path.join(backendDir, f));
        deleted.push(f);
      }
    }
    return Response.json({ success: true, deleted });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
