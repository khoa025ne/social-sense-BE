using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SocialSense.Migrations
{
    /// <inheritdoc />
    public partial class AddApiKeyEncryptionAndMultiModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "KeyValue",
                table: "ApiKeyConfigs",
                type: "varchar(500)",
                maxLength: 500,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(200)",
                oldMaxLength: 200)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "IsEncrypted",
                table: "ApiKeyConfigs",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ModelOverride",
                table: "ApiKeyConfigs",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Provider",
                table: "ApiKeyConfigs",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "openrouter")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "SupportsImageGen",
                table: "ApiKeyConfigs",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsEncrypted",
                table: "ApiKeyConfigs");

            migrationBuilder.DropColumn(
                name: "ModelOverride",
                table: "ApiKeyConfigs");

            migrationBuilder.DropColumn(
                name: "Provider",
                table: "ApiKeyConfigs");

            migrationBuilder.DropColumn(
                name: "SupportsImageGen",
                table: "ApiKeyConfigs");

            migrationBuilder.AlterColumn<string>(
                name: "KeyValue",
                table: "ApiKeyConfigs",
                type: "varchar(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(500)",
                oldMaxLength: 500)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");
        }
    }
}
