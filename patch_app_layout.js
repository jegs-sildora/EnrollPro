const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/client/src/shared/layouts/AppLayout.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('UserPhoto')) {
    content = content.replace(
        'import { Skeleton } from "@/shared/ui/skeleton";',
        'import { Skeleton } from "@/shared/ui/skeleton";\nimport { UserPhoto } from "@/shared/components/UserPhoto";'
    );
}

content = content.replace(
    /<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">\s*\{initials\}\s*<\/div>/g,
    `{user?.photoPath ? (
              <UserPhoto
                photo={user.photoPath}
                containerClassName="flex size-8 shrink-0 rounded-full border-2 border-primary border-solid overflow-hidden"
                className="w-full h-full object-cover"
                alt={displayName}
              />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground border-2 border-primary border-solid">
                {initials}
              </div>
            )}`
);

fs.writeFileSync(file, content);
console.log('patched app layout');
