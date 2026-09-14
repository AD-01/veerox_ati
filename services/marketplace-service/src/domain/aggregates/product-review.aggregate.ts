import { AggregateRoot } from '@nestjs/cqrs';

export class ProductReview extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly workspaceId: string, // Reviewer's workspace
    public readonly userId: string,      // Actual user who wrote it
    public rating: number,
    public comment: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {
    super();
  }

  static submit(props: {
    id: string;
    productId: string;
    workspaceId: string;
    userId: string;
    rating: number;
    comment: string | null;
  }): ProductReview {
    if (props.rating < 1 || props.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    return new ProductReview(
      props.id,
      props.productId,
      props.workspaceId,
      props.userId,
      props.rating,
      props.comment,
      new Date(),
      new Date()
    );
  }

  update(props: {
    rating?: number;
    comment?: string;
  }): void {
    if (props.rating !== undefined) {
      if (props.rating < 1 || props.rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      this.rating = props.rating;
    }
    if (props.comment !== undefined) {
      this.comment = props.comment;
    }
    this.updatedAt = new Date();
  }
}
