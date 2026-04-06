const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function findDtoFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findDtoFiles(fullPath, fileList);
    } else if (file.endsWith('.dto.ts') || file.includes('dto')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const dtoFiles = findDtoFiles(srcDir);

for (const file of dtoFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Add ApiProperty import if not present and we are going to add it
  let needsImport = false;
  
  // Basic properties matching
  const propertyRegex = /(@Is[A-Za-z]+\([^)]*\)\s*)+(?:@Min[^]*?\s*|@Max[^]*?\s*|@Matches[^]*?\s*|@Transform[^]*?\s*)*([a-zA-Z0-9_]+)[!?]?:\s*([a-zA-Z0-9_]+(?:\s*\[\])?);?/g;

  content = content.replace(propertyRegex, (match, decorators, propName, propType) => {
    if (match.includes('@ApiProperty(')) return match; // Already has it
    
    let example = "'example value'";
    
    if (match.includes('@IsEmail')) example = "'user@example.com'";
    else if (match.includes('@IsPhoneNumber') || propName.toLowerCase().includes('phone')) example = "'0901234567'";
    else if (propName.toLowerCase().includes('password')) example = "'Password@123'";
    else if (propType === 'number') example = propName.includes('amount') || propName.includes('price') ? "50000" : "1";
    else if (propType === 'boolean') example = "true";
    else if (propType === 'number[]') example = "[1, 2, 3]";
    else if (propType === 'string[]') example = "['tag1', 'tag2']";
    else if (propName.toLowerCase().includes('url')) example = "'https://example.com/image.jpg'";
    else if (propName.toLowerCase().includes('name') || propName.toLowerCase().includes('title')) example = "'Mẫu tài liệu/Sản phẩm'";
    else if (propName.toLowerCase().includes('description') || propName.toLowerCase().includes('reason')) example = "'Mô tả chi tiết về lý do hoặc nội dung'";
    else if (propName.toLowerCase().includes('status')) example = "'PENDING'";
    
    needsImport = true;
    return `@ApiProperty({ example: ${example} })\n  ${match.trim()}`;
  });

  if (needsImport && !content.includes('ApiProperty')) {
    if (content.includes('@nestjs/swagger')) {
      content = content.replace(/(import\s+{.*?)(}\s+from\s+['"]@nestjs\/swagger['"])/, `$1, ApiProperty$2`);
    } else {
      content = "import { ApiProperty } from '@nestjs/swagger';\n" + content;
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Added examples to ${path.basename(file)}`);
  }
}
