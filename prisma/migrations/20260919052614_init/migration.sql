-- CreateTable
CREATE TABLE "PlantingArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "species" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANEJADA',
    "coordinates" TEXT NOT NULL,
    "areaM2" REAL NOT NULL,
    "perimeterM" REAL NOT NULL,
    "centerLat" REAL NOT NULL,
    "centerLng" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PlantingArea_createdAt_idx" ON "PlantingArea"("createdAt");
