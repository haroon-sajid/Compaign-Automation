# organizations/forms.py

from django import forms
# Import the model from the accounts app
from accounts.models import OrganizationMember, OrganizationSettings, Organization


class OrganizationCreateForm(forms.Form):
    name = forms.CharField(
        label="Organization Name",
        max_length=100,
        widget=forms.TextInput(attrs={'placeholder': "Your New Team's Name"})
    )


class MemberInviteForm(forms.Form):
    email = forms.EmailField(
        label="Invite by Email",
        widget=forms.EmailInput(attrs={'placeholder': 'user@example.com'})
    )


class RoleChangeForm(forms.Form):
    role = forms.ChoiceField(choices=OrganizationMember.Role.choices)


class OrganizationSettingsForm(forms.ModelForm):
    # We also want to edit the organization's name in the same form
    name = forms.CharField(max_length=100)

    class Meta:
        model = OrganizationSettings 
        fields = ['webhook_url']  

    def __init__(self, *args, **kwargs):
        # We need to handle the 'name' field separately
        org_instance = kwargs['instance'].organization
        initial = kwargs.get('initial', {})
        initial['name'] = org_instance.name
        kwargs['initial'] = initial

        super().__init__(*args, **kwargs)

        self.fields['name'].widget.attrs.update(
            {'class': 'form-control', 'placeholder': "Your Team's Name"}
        )
        self.fields['webhook_url'].widget.attrs.update(
            {'class': 'form-control', 'placeholder': 'https://your-endpoint.com/webhook'}
        )

    def save(self, commit=True):
        # Save the OrganizationSettings part
        settings_instance = super().save(commit=commit)

        # Save the Organization name part
        org_instance = settings_instance.organization
        org_instance.name = self.cleaned_data['name']
        if commit:
            org_instance.save()

        return settings_instance
