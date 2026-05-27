using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SocialSense.Migrations
{
    /// <inheritdoc />
    public partial class AddContentHistoryFeedbackLoop : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsEdited",
                table: "ContentHistories",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "UserEditedContent",
                table: "ContentHistories",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ContentHistories_OriginalTrendId",
                table: "ContentHistories",
                column: "OriginalTrendId");

            migrationBuilder.AddForeignKey(
                name: "FK_ContentHistories_Trends_OriginalTrendId",
                table: "ContentHistories",
                column: "OriginalTrendId",
                principalTable: "Trends",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ContentHistories_Trends_OriginalTrendId",
                table: "ContentHistories");

            migrationBuilder.DropIndex(
                name: "IX_ContentHistories_OriginalTrendId",
                table: "ContentHistories");

            migrationBuilder.DropColumn(
                name: "IsEdited",
                table: "ContentHistories");

            migrationBuilder.DropColumn(
                name: "UserEditedContent",
                table: "ContentHistories");
        }
    }
}
