using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SocialSense.Migrations
{
    /// <inheritdoc />
    public partial class AddKnowledgeBaseTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "KnowledgeItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Title = table.Column<string>(type: "varchar(250)", maxLength: 250, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SourceType = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SourceUrlOrFileName = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ContentHash = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    RawContent = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KnowledgeItems", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "KnowledgeChunks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ItemId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ChunkText = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AiSummary = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AiInsightsJson = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Category = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    KeywordsJson = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KnowledgeChunks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KnowledgeChunks_KnowledgeItems_ItemId",
                        column: x => x.ItemId,
                        principalTable: "KnowledgeItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_KnowledgeChunks_ItemId",
                table: "KnowledgeChunks",
                column: "ItemId");

            migrationBuilder.CreateIndex(
                name: "IX_KnowledgeItems_ContentHash",
                table: "KnowledgeItems",
                column: "ContentHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "KnowledgeChunks");

            migrationBuilder.DropTable(
                name: "KnowledgeItems");
        }
    }
}
