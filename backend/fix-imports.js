const fs = require('fs');
const path = require('path');

function fixImports(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixImports(fullPath);
    } else if (file.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('@ApiProperty') && !content.includes('ApiProperty')) {
        // Wait, content.includes('ApiProperty') is true if '@ApiProperty' matches.
      }
      
      if (content.includes('@ApiProperty') && !content.match(/import\s+{.*ApiProperty.*}\s+from\s+['"]@nestjs\/swagger['"]/)) {
        if (content.match(/import\s+{.*}\s+from\s+['"]@nestjs\/swagger['"]/)) {
          content = content.replace(/(import\s+{.*?)(}\s+from\s+['"]@nestjs\/swagger['"])/, `$1, ApiProperty$2`);
        } else {
          content = "import { ApiProperty } from '@nestjs/swagger';\n" + content;
        }
        fs.writeFileSync(fullPath, content);
        console.log('Fixed imports in', file);
      }
    }
  }
}

fixImports(path.join(__dirname, 'src'));
