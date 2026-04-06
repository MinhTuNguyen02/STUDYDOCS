const fs = require('fs');
const path = require('path');

const fileMapping = {
  'auth.controller.ts': 'Auth & Users',
  'users.controller.ts': 'Auth & Users',
  'documents.controller.ts': 'Documents',
  'library.controller.ts': 'Documents / Library',
  'downloads.controller.ts': 'Documents / Downloads',
  'seller.controller.ts': 'Seller Actions',
  'cart.controller.ts': 'Shop & Order',
  'checkout.controller.ts': 'Shop & Order',
  'orders.controller.ts': 'Shop & Order',
  'wishlists.controller.ts': 'Shop & Order',
  'categories.controller.ts': 'Metadata',
  'tags.controller.ts': 'Metadata',
  'reviews.controller.ts': 'Interactions (Reviews, Reports, Disputes)',
  'reports.controller.ts': 'Interactions (Reviews, Reports, Disputes)',
  'moderation.controller.ts': 'Interactions (Reviews, Reports, Disputes)',
  'disputes.controller.ts': 'Interactions (Reviews, Reports, Disputes)',
  'wallets.controller.ts': 'Financial & Wallets',
  'packages.controller.ts': 'Financial & Packages',
  'configs.controller.ts': 'System & Admin',
  'policies.controller.ts': 'System & Admin',
  'admin.controller.ts': 'System & Admin'
};

const srcDir = path.join(__dirname, 'src', 'modules');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (file.endsWith('.controller.ts')) {
      const tag = fileMapping[file] || 'Default';
      let content = fs.readFileSync(fullPath, 'utf8');

      // Check if already has ApiTags
      if (!content.includes('@ApiTags(')) {
        // Add import
        if (content.includes('@nestjs/swagger')) {
          content = content.replace(/(import\s+{.*?)(}\s+from\s+['"]@nestjs\/swagger['"])/, `$1, ApiTags$2`);
        } else {
          content = "import { ApiTags } from '@nestjs/swagger';\n" + content;
        }

        // Add above @Controller
        content = content.replace(/(@Controller\(.*?\))/g, `@ApiTags('${tag}')\n$1`);
        
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${file} with tag '${tag}'`);
      } else {
        console.log(`Skipped ${file} - already tagged`);
      }
    }
  }
}

processDir(srcDir);
