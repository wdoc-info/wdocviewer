import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface MessageDialogData {
  title: string;
  message: string;
  confirm?: boolean;
}

@Component({
  selector: 'app-message-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button *ngIf="data.confirm" mat-dialog-close="false">
        Cancel
      </button>
      <button mat-flat-button color="primary" (click)="closeWithResult(true)">
        {{ data.confirm ? 'OK' : 'Close' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class MessageDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<MessageDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: MessageDialogData,
  ) {}

  closeWithResult(result: boolean) {
    this.dialogRef.close(result);
  }
}
