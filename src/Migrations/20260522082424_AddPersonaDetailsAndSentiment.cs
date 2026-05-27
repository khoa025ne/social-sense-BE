using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SocialSense.Migrations
{
    /// <inheritdoc />
    public partial class AddPersonaDetailsAndSentiment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContentFormatsJson",
                table: "UserContexts",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "NegativeConstraintsJson",
                table: "UserContexts",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "TargetAudienceJson",
                table: "UserContexts",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Sentiment",
                table: "Trends",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ContentFormatsJson",
                table: "UserContexts");

            migrationBuilder.DropColumn(
                name: "NegativeConstraintsJson",
                table: "UserContexts");

            migrationBuilder.DropColumn(
                name: "TargetAudienceJson",
                table: "UserContexts");

            migrationBuilder.DropColumn(
                name: "Sentiment",
                table: "Trends");
        }
    }
}
